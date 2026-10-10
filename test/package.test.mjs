// Packaging contract: the tarball must be installable and usable by a
// real consumer — entry present, wasm present, types present. This
// exists because `files: ["dist"]` once excluded the entry file that
// `main` pointed at: a published package whose API could not load.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("npm pack ships the entry, the wasm and the types", () => {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  const files = JSON.parse(out)[0].files.map((f) => f.path);
  for (const need of [
    "src/index.js",
    "src/index.d.ts",
    "dist/teptris.mjs",
    "dist/teptris.wasm",
    "package.json",
    "README.md",
  ]) {
    assert.ok(files.includes(need), `tarball missing ${need}`);
  }
});

test("a fresh consumer can install and use the package", () => {
  const dir = mkdtempSync(join(tmpdir(), "teptris-pkg-"));
  try {
    const [tarball] = execFileSync("npm", ["pack", "--pack-destination", dir], {
      cwd: root,
      encoding: "utf8",
    }).trim().split("\n");
    const consumer = join(dir, "consumer");
    execFileSync("mkdir", ["-p", consumer]);
    writeFileSync(join(consumer, "package.json"), '{ "private": true }\n');
    execFileSync("npm", ["install", "--no-audit", "--no-fund", join(dir, tarball)],
                 { cwd: consumer, encoding: "utf8" });
    const script = `
      import assert from "node:assert/strict";
      const { init } = await import("teptris");
      const t = await init();
      const doc = t.loads('title = "pkg"\\npi = 3.5\\nat = 2026-10-09T12:00:00Z\\n');
      assert.equal(doc.title, "pkg");
      assert.deepEqual(t.loads(t.dump(doc)), doc);
      assert.deepEqual(JSON.parse(t.dumpJson(doc)), doc);
      assert.match(t.engineVersion(), /^\\d+\\.\\d+\\./);
      console.log("TARBALL-CONSUMER-OK");
    `;
    writeFileSync(join(consumer, "check.mjs"), script);
    const out = execFileSync("node", ["check.mjs"], {
      cwd: consumer,
      encoding: "utf8",
    });
    assert.ok(out.includes("TARBALL-CONSUMER-OK"), out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the type declarations type-check against a consumer", () => {
  const dir = mkdtempSync(join(tmpdir(), "teptris-ts-"));
  try {
    const consumer = join(dir, "consumer");
    execFileSync("mkdir", ["-p", consumer]);
    writeFileSync(join(consumer, "package.json"),
                  '{ "private": true, "type": "module" }\n');
    writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: "node16",
        moduleResolution: "node16",
        skipLibCheck: true,
      },
      include: ["check.ts"],
    }));
    writeFileSync(join(consumer, "check.ts"), `
      import { init, type TeptrisApi } from "teptris";
      const api: TeptrisApi = await init();
      const doc = api.loads('a = 1\\n[b]\\nc = "x"\\n');
      const n: number | null = doc.a as number;
      const s: string = api.dump(doc);
      const j: string = api.dumpJson(doc);
      console.log(n, s, j);
    `);
    const [tarball] = execFileSync("npm", ["pack", "--pack-destination", dir], {
      cwd: root,
      encoding: "utf8",
    }).trim().split("\n");
    execFileSync("npm", ["install", "--no-audit", "--no-fund", join(dir, tarball)],
                 { cwd: consumer, encoding: "utf8" });
    execFileSync("npx", ["-y", "-p", "typescript@5", "tsc", "-p", "tsconfig.json"],
                 { cwd: consumer, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
