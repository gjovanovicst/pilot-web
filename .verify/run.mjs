// Fallback test runner for src/pages/SignIn.test.tsx:  node .verify/run.mjs
//
// PREFER `pnpm test` (vitest). This file exists only because the sandbox this
// task was developed in is Alpine (musl) with no network: the lockfile pins
// Rollup 4 but only the glibc native binding was installed, so
// `@rollup/rollup-linux-x64-musl` was missing and vitest aborted before it
// collected any test (see the note in the task report).
//
// With that dependency in place `vitest run` works normally. Without it, this
// runner executes the *real* test file instead: esbuild for the TSX transform,
// jsdom for the DOM, and a tiny `vitest` shim for describe/it/expect. It is a
// local diagnostic only; delete the whole .verify/ directory if you don't need
// it.
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);

/** esbuild is only installed transitively, so resolve it out of the pnpm store. */
function loadEsbuild() {
  const store = path.resolve("node_modules/.pnpm");
  const entry = existsSync(store) && readdirSync(store).find((name) => name.startsWith("esbuild@"));
  if (!entry) throw new Error("esbuild is not installed; run `pnpm install` first.");
  return require(path.join(store, entry, "node_modules", "esbuild"));
}

const esbuild = loadEsbuild();

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const outfile = path.join(mkdtempSync(path.join(tmpdir(), "signin-verify-")), "bundle.mjs");

await esbuild.build({
  entryPoints: [path.resolve("src/pages/SignIn.test.tsx")],
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outfile,
  alias: { vitest: path.resolve(".verify/vitest-shim.mjs") },
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "warning",
});

await import(pathToFileURL(outfile).href);

const tests = globalThis.__VERIFY_TESTS__ ?? [];
let failures = 0;
for (const test of tests) {
  try {
    await test.fn();
    console.log(` \u2713 ${test.name}`);
  } catch (error) {
    failures += 1;
    console.log(` \u2717 ${test.name}`);
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} tests passed (offline harness)`);
process.exit(failures === 0 && tests.length > 0 ? 0 : 1);
