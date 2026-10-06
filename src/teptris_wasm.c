/* The wasm surface: one contained bridge over the zero-copy core.
 * Input bytes are copied INTO the wasm heap; the document's views live
 * inside the heap for the duration of the call; the JSON answer leaves
 * before the document is freed. The host never holds a heap pointer
 * past the call - the C buffer-lifetime contract stays internal. */
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "teptris/teptris.h"

static char *g_json;
static size_t g_json_len;

static char last_error[256];
static int last_error_line;
static int last_error_column;

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_load(const char *data, size_t len) {
    teptris_document *doc = NULL;
    teptris_status st = teptris_parse(data, len, NULL, &doc);
    if (st != TEPTRIS_OK || doc == NULL) {
        if (doc != NULL) {
            /* read the error BEFORE the free - it points into the doc */
            const teptris_error *e = teptris_document_error(doc);
            snprintf(last_error, sizeof last_error, "%s", e->message);
            last_error_line = (int)e->line;
            last_error_column = (int)e->column;
            teptris_document_free(doc);
        } else {
            snprintf(last_error, sizeof last_error, "parse failed");
            last_error_line = 0;
            last_error_column = 0;
        }
        return (int)st;
    }
    st = teptris_document_emit_json_natural(doc, &g_json, &g_json_len);
    teptris_document_free(doc);
    return (int)st;
}

EMSCRIPTEN_KEEPALIVE
const char *teptris_wasm_last_error(void) { return last_error; }

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_last_error_line(void) { return last_error_line; }

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_last_error_column(void) { return last_error_column; }

EMSCRIPTEN_KEEPALIVE
const char *teptris_wasm_json(void) { return g_json; }

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_json_len(void) { return (int)g_json_len; }

EMSCRIPTEN_KEEPALIVE
void teptris_wasm_free(void *p) { free(p); }

/* ---- builder surface (the dump side) ----------------------------- *
 * 1:1 with teptris_builder_*: the JS wrapper drives the same stack
 * discipline (open/close, NULL key = array element) the C and Rust
 * bindings use, so the emitter stays the single formatting truth. */

EMSCRIPTEN_KEEPALIVE
void *teptris_wasm_builder_new(void) { return teptris_builder_new(); }

EMSCRIPTEN_KEEPALIVE
void teptris_wasm_builder_free(void *b) { teptris_builder_free(b); }

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_put_string(void *b, const char *key,
                                    const char *val) {
    return teptris_builder_put_string(b, key, key ? strlen(key) : 0,
                                      val, strlen(val));
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_put_integer(void *b, const char *key,
                                     int64_t v) {
    return teptris_builder_put_integer(b, key, key ? strlen(key) : 0, v);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_put_float(void *b, const char *key, double v) {
    return teptris_builder_put_float(b, key, key ? strlen(key) : 0, v);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_put_boolean(void *b, const char *key, int v) {
    return teptris_builder_put_boolean(b, key, key ? strlen(key) : 0,
                                       v != 0);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_put_datetime(void *b, const char *key, int kind,
                                      int32_t year, uint8_t month,
                                      uint8_t day, uint8_t hour,
                                      uint8_t minute, uint8_t second,
                                      uint32_t nanosecond,
                                      int32_t offset_seconds) {
    teptris_datetime dt = {year, month, day, hour, minute, second,
                           nanosecond, offset_seconds};
    return teptris_builder_put_datetime(
        b, key, key ? strlen(key) : 0, (teptris_kind)kind, &dt);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_open_table(void *b, const char *key) {
    return teptris_builder_open_table(b, key, key ? strlen(key) : 0);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_open_array(void *b, const char *key) {
    return teptris_builder_open_array(b, key, key ? strlen(key) : 0);
}

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_close(void *b) {
    return teptris_builder_close(b);
}

/* finish -> canonical TOML in g_toml (same accessor pattern as the
 * parse-side JSON) */
static char *g_toml;
static size_t g_toml_len;

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_builder_finish(void *b) {
    teptris_document *doc = NULL;
    teptris_status st = teptris_builder_finish(b, &doc);
    if (st != TEPTRIS_OK) {
        return (int)st;
    }
    char *buf = NULL;
    size_t len = 0;
    st = teptris_document_emit(doc, &buf, &len);
    teptris_document_free(doc);
    if (st != TEPTRIS_OK) {
        return (int)st;
    }
    g_toml = buf;
    g_toml_len = len;
    return TEPTRIS_OK;
}

EMSCRIPTEN_KEEPALIVE
const char *teptris_wasm_toml(void) { return g_toml; }

EMSCRIPTEN_KEEPALIVE
int teptris_wasm_toml_len(void) { return (int)g_toml_len; }
