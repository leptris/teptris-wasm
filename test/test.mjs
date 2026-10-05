import init from "../dist/teptris.mjs";

const mod = await init();
const { UTF8ToString, stringToUTF8, lengthBytesUTF8 } = mod;

// v0 contract: emit_json's conformance dialect - tagged values
// {"type": "...", "value": "..."}; a natural-JSON (typed) emit is the
// engine-side v1 item.
function load(toml) {
  const bytes = lengthBytesUTF8(toml) + 1;
  const ptr = mod._malloc(bytes);
  stringToUTF8(toml, ptr, bytes);
  const st = mod._teptris_wasm_load(ptr, bytes - 1);
  let json = null, err = null;
  if (st === 0) {
    const jptr = mod._teptris_wasm_json();
    json = JSON.parse(UTF8ToString(jptr));
    mod._teptris_wasm_free(jptr);
  } else {
    err = { message: UTF8ToString(mod._teptris_wasm_last_error()),
            line: mod._teptris_wasm_last_error_line(),
            column: mod._teptris_wasm_last_error_column() };
  }
  mod._teptris_wasm_free(ptr);
  return { st, json, err };
}

const ok = load('name = "wasm"\nport = 8080\n[server]\nhost = "0.0.0.0"\n');
console.log("parse:", JSON.stringify(ok.json));
if (ok.st !== 0) throw new Error("parse should succeed");
if (ok.json.name.value !== "wasm" || ok.json.port.value !== "8080")
  throw new Error("values");
if (ok.json.server.host.value !== "0.0.0.0") throw new Error("table");

const nested = load("a = 1\n[t]\nk = 1.5\narr = [1, 2]\n");
if (nested.json.a.value !== "1" || nested.json.t.k.type !== "float" ||
    !Array.isArray(nested.json.t.arr) || nested.json.t.arr.length !== 2 ||
    nested.json.t.arr[1].value !== "2")
  throw new Error("nested");

const bad = load("bogus =\n");
if (bad.st === 0 || !bad.err.message || bad.err.line < 1) throw new Error("error report");
console.log("error report:", JSON.stringify(bad.err));

const unicode = load('s = "café ☕"\n');
if (unicode.json.s.value !== "café ☕") throw new Error("utf8");
console.log("WASM SPIKE OK (88kB wasm, conformance JSON v0)");
