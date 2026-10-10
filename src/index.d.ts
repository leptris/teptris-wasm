/**
 * teptris — TOML 1.1 for JavaScript/TypeScript at libteptris
 * speed (WebAssembly, no fallback).
 *
 *   const teptris = await init();
 *   const doc = teptris.loads('title = "demo"');
 *   const toml = teptris.dump(doc);
 *   const json = teptris.dumpJson(doc);
 */

/** A parsed TOML value: datetimes are RFC 3339 strings, non-finite
 *  floats (nan/inf) are null. */
export type TomlValue =
  | string
  | number
  | boolean
  | null
  | TomlTable
  | TomlValue[];

/** A TOML table: string keys, insertion-ordered. */
export interface TomlTable {
  [key: string]: TomlValue;
}

/** Parse errors carry the engine's line/column (1-based). */
export interface TeptrisError extends Error {
  line: number;
  column: number;
}

export interface TeptrisApi {
  /** Parse TOML into a JS object (natural-JSON view: real numbers,
   *  booleans, RFC 3339 datetime strings, non-finite floats as
   *  null). Throws TeptrisError on invalid input. */
  loads(toml: string): TomlTable;

  /** Serialize a table to canonical TOML via the engine builder.
   *  RFC 3339 strings re-enter as datetimes. Throws TypeError for
   *  non-table roots, Error for unsupported values. */
  dump(value: TomlTable): string;

  /** Serialize a table to natural JSON (the engine's fastest emit
   *  mode): real numbers, booleans, RFC 3339 datetime strings,
   *  non-finite floats as null. */
  dumpJson(value: TomlTable): string;

  /** The libteptris engine version inside this build. */
  engineVersion(): string;
}

/** Instantiate the WebAssembly engine and return the API. */
export function init(): Promise<TeptrisApi>;

/** Advanced: wrap an already-instantiated engine module (custom
 *  instantiation, browser bundlers with special wasm loading). */
export function initApi(mod: unknown): TeptrisApi;

export default init;
