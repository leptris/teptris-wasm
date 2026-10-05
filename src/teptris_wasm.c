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
    st = teptris_document_emit_json(doc, &g_json, &g_json_len);
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
