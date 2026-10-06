// The public surface: natural-JSON loads + builder-driven dumps.
// Engine FFI through ../dist/teptris.mjs (built by build.sh).

const KIND_OFFSET = 4, KIND_LOCAL_DT = 5, KIND_DATE = 6, KIND_TIME = 7;

function cstr(mod, s) {
  const bytes = mod.lengthBytesUTF8(s) + 1;
  const ptr = mod._malloc(bytes);
  mod.stringToUTF8(s, ptr, bytes);
  return ptr;
}

function freeCstr(mod, ptr) { mod._teptris_wasm_free(ptr); }

// RFC 3339-ish (the four TOML shapes) back into builder fields
function parseDateTime(str) {
  let m = str.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/);
  if (m) {
    const kind = m[8] ? KIND_OFFSET : KIND_LOCAL_DT;
    let offset = 0;
    if (m[8] && m[8] !== "Z") {
      const sign = m[8][0] === "-" ? -1 : 1;
      const hh = parseInt(m[8].slice(1, 3), 10);
      const mm = parseInt(m[8].slice(4, 6), 10);
      offset = sign * (hh * 3600 + mm * 60);
    }
    return {
      kind, year: +m[1], month: +m[2], day: +m[3], hour: +m[4],
      minute: +m[5], second: +m[6],
      nanosecond: m[7] ? Math.floor(+("0." + m[7]) * 1e9) : 0,
      offset_seconds: offset,
    };
  }
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return { kind: KIND_DATE, year: +m[1], month: +m[2], day: +m[3],
             hour: 0, minute: 0, second: 0, nanosecond: 0,
             offset_seconds: 0 };
  }
  m = str.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (m) {
    return { kind: KIND_TIME, year: 0, month: 0, day: 0, hour: +m[1],
             minute: +m[2], second: +m[3],
             nanosecond: m[4] ? Math.floor(+("0." + m[4]) * 1e9) : 0,
             offset_seconds: 0 };
  }
  return null;
}

const RFC3339 =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$|^\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function buildValue(mod, b, key, v, errs) {
  const kp = key == null ? 0 : cstr(mod, key);
  try {
    if (v === null || v === undefined) {
      throw new Error("null/undefined cannot round-trip through TOML");
    }
    switch (typeof v) {
      case "number":
        if (Number.isInteger(v)) {
          mod._teptris_wasm_builder_put_integer(b, kp, BigInt(v));
        } else {
          mod._teptris_wasm_builder_put_float(b, kp, v);
        }
        return;
      case "boolean":
        mod._teptris_wasm_builder_put_boolean(b, kp, v ? 1 : 0);
        return;
      case "string":
        // RFC 3339 strings from loads() re-enter as datetimes; a
        // plain string stays a string
        if (RFC3339.test(v)) {
          const dt = parseDateTime(v);
          mod._teptris_wasm_builder_put_datetime(
            b, kp, dt.kind, dt.year, dt.month, dt.day, dt.hour,
            dt.minute, dt.second, dt.nanosecond, dt.offset_seconds);
          return;
        }
        const vp = cstr(mod, v);
        mod._teptris_wasm_builder_put_string(b, kp, vp);
        freeCstr(mod, vp);
        return;
      default:
        break;
    }
    if (Array.isArray(v)) {
      mod._teptris_wasm_builder_open_array(b, kp);
      for (const item of v) buildValue(mod, b, null, item, errs);
      mod._teptris_wasm_builder_close(b);
      return;
    }
    if (typeof v === "object") {
      // open_table with a NULL key = element of the current array
      // (array-of-tables); the root table itself is implicit (see
      // dump - it iterates root entries directly)
      mod._teptris_wasm_builder_open_table(b, kp);
      for (const [k, item] of Object.entries(v)) {
        buildValue(mod, b, k, item, errs);
      }
      mod._teptris_wasm_builder_close(b);
      return;
    }
    errs.push(new Error(`unsupported value: ${String(v)}`));
  } finally {
    if (kp) freeCstr(mod, kp);
  }
}

export function initApi(mod) {
  const { UTF8ToString, stringToUTF8, lengthBytesUTF8 } = mod;

  function loads(toml) {
    if (typeof toml !== "string") {
      throw new TypeError("loads expects a string");
    }
    const ptr = cstr(mod, toml);
    const st = mod._teptris_wasm_load(ptr, lengthBytesUTF8(toml));
    let value = null, error = null;
    if (st === 0) {
      const jptr = mod._teptris_wasm_json();
      value = JSON.parse(UTF8ToString(jptr));
      mod._teptris_wasm_free(jptr);
    } else {
      error = {
        message: UTF8ToString(mod._teptris_wasm_last_error()),
        line: mod._teptris_wasm_last_error_line(),
        column: mod._teptris_wasm_last_error_column(),
        status: st,
      };
    }
    freeCstr(mod, ptr);
    if (error) {
      const e = new Error(
        `${error.message} (line ${error.line}, column ${error.column})`);
      e.line = error.line;
      e.column = error.column;
      throw e;
    }
    return value;
  }

  function dump(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      throw new TypeError("dump expects a table object (TOML roots are tables)");
    }
    const b = mod._teptris_wasm_builder_new();
    const errs = [];
    try {
      // the root table is implicit: entries attach directly
      for (const [k, item] of Object.entries(obj)) {
        buildValue(mod, b, k, item, errs);
      }
      if (errs.length) throw errs[0];
      const st = mod._teptris_wasm_builder_finish(b);
      if (st !== 0) {
        throw new Error(`dump failed (status ${st})`);
      }
      const tptr = mod._teptris_wasm_toml();
      const out = UTF8ToString(tptr);
      mod._teptris_wasm_free(tptr);
      return out;
    } finally {
      mod._teptris_wasm_builder_free(b);
    }
  }

  function engineVersion() {
    return UTF8ToString(mod._teptris_version_string());
  }

  return { loads, dump, engineVersion };
}

export default initApi;
