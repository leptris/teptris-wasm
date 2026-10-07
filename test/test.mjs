import test from "node:test";
import assert from "node:assert/strict";
import init from "../dist/teptris.mjs";
import initApi from "../src/index.js";

const mod = await init();
const { loads, dump, engineVersion } = initApi(mod);

test("loads returns natural JSON", () => {
  const doc = loads('name = "wasm"\nport = 8080\nratio = 1.5\non = true\n' +
                    '[server]\nhost = "0.0.0.0"\narr = [1, "two", 3.5]\n');
  assert.equal(doc.name, "wasm");
  assert.equal(doc.port, 8080);
  assert.equal(doc.ratio, 1.5);
  assert.equal(doc.on, true);
  assert.equal(doc.server.host, "0.0.0.0");
  assert.equal(doc.server.arr[2], 3.5);
});

test("datetimes come back as RFC 3339 strings", () => {
  const dts = loads('o = 1979-05-27T07:32:00-07:00\nd = 1979-05-27\nt = 07:32:00\n');
  assert.equal(dts.o, "1979-05-27T07:32:00-07:00");
  assert.equal(dts.d, "1979-05-27");
  assert.equal(dts.t, "07:32:00");
});

test("non-finite floats are null (documented lossy mapping)", () => {
  assert.equal(loads("x = nan\n").x, null);
});

test("errors carry message + line/column", () => {
  assert.throws(() => loads("bogus =\n"), (e) => e instanceof Error && e.line >= 1);
});

test("dump round-trips through the builder", () => {
  const src = 'name = "rt"\nport = 8080\nratio = 0.25\non = false\n' +
              'o = 1979-05-27T07:32:00-07:00\n' +
              '[server]\nhost = "h"\narr = [1, 2]\n' +
              '[[items]]\nid = 1\n[[items]]\nid = 2\n';
  const v = loads(src);
  const v2 = loads(dump(v));
  assert.deepEqual(v, v2);
});

test("dump accepts plain JS objects", () => {
  const back = loads(dump({ a: 1, b: [1.5, "x"], nested: { k: true } }));
  assert.equal(back.a, 1);
  assert.equal(back.b[0], 1.5);
  assert.equal(back.nested.k, true);
});

test("dump rejects non-table roots", () => {
  assert.throws(() => dump([1, 2]), TypeError);
});

test("engineVersion reports", () => {
  assert.match(engineVersion(), /^\d+\.\d+\./);
});
