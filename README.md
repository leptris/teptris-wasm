# teptris-wasm

TOML for JavaScript at libteptris speed — the engine compiled to
WebAssembly (emscripten, ES module), no fallback.

```js
import init from "teptris-wasm";
const mod = await init();
const { teptris } = mod;              // after src/index.js lands in v0.1.1
teptris.loads('a = 1');               // → { a: { type: "integer", value: "1" } }
```

**v0 status (spike):** the surface is `load(toml)` over the engine's
`emit_json` — the toml-test conformance dialect (tagged values:
`{type, value}`; arrays are bare arrays of tagged values). Errors carry
`message`/`line`/`column`. A natural-JSON (typed-value) emit is the v1
item (engine-side: a typed-JSON emit mode); `dumps` follows it.

## Build

```sh
ENGINESRC=../teptris/src ./build.sh   # emscripten required
npm test
```

The bridge copies input bytes INTO the wasm heap; the engine's
zero-copy buffer-lifetime contract stays internal — the host never
holds a heap pointer past the call.
