# teptris (JavaScript/TypeScript)

TOML for JavaScript at libteptris speed — the engine compiled to
WebAssembly (emscripten, ES module), no fallback.

```js
import { init } from "teptris";

const teptris = await init();
teptris.loads('a = 1');               // → { a: 1 }
teptris.dump(obj);                    // → canonical TOML string
teptris.dumpJson(obj);                // → natural JSON string
teptris.engineVersion();              // → the libteptris inside
```

TypeScript ships first-class: `src/index.d.ts` types the full surface
(`init`, `TeptrisApi`, `TomlTable`, `TeptrisError` with
`line`/`column`) — strict `tsc` consumers are part of the test suite.
For custom instantiation (bundler-managed wasm loading), `initApi(mod)`
wraps an already-instantiated emscripten module.

**Surface (v1, engine 0.3.0):** `loads` uses the natural-JSON emit —
real numbers, booleans, RFC 3339 datetime strings, non-finite floats
as `null`. `dump` emits canonical TOML through the builder; `dumpJson`
emits the same tree as natural JSON — the string a host hands straight
to JSON consumers, and the engine's fastest emit mode. Errors carry
`message`/`line`/`column`.

## Build

```sh
ENGINESRC=../teptris/src ./build.sh   # emscripten required
npm test
```

The bridge copies input bytes INTO the wasm heap; the engine's
zero-copy buffer-lifetime contract stays internal — the host never
holds a heap pointer past the call.
