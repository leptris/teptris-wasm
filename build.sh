#!/usr/bin/env bash
# Builds the ES module + wasm from the vendored engine sources.
#   ENGINESRC defaults to ../teptris/src (sibling checkout)
set -euo pipefail
cd "$(dirname "$0")"
ENGINESRC="${ENGINESRC:-../teptris/src}"
mkdir -p dist
emcc -O3 -std=c99 \
  -I"$ENGINESRC/include" -I"$ENGINESRC" \
  src/teptris_wasm.c \
  "$ENGINESRC"/teptris/*.c \
  "$ENGINESRC"/teptris/*/*.c \
  "$ENGINESRC"/teptris/*/*/*.c \
  -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,node \
  -s EXPORTED_RUNTIME_METHODS="['UTF8ToString','stringToUTF8','lengthBytesUTF8']" \
  -s EXPORTED_FUNCTIONS='["_teptris_wasm_load","_teptris_wasm_json","_teptris_wasm_json_len","_teptris_wasm_last_error","_teptris_wasm_last_error_line","_teptris_wasm_last_error_column","_teptris_wasm_free","_malloc"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -o dist/teptris.mjs
ls -la dist/
