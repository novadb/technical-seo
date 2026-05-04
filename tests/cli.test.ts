import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, normalizeUrl } from "../src/cli.js";

test("parseArgs: -h sets help", () => {
  assert.deepEqual(parseArgs(["-h"]), { url: null, help: true, version: false, noColor: false });
});

test("parseArgs: --help sets help", () => {
  assert.equal(parseArgs(["--help"]).help, true);
});

test("parseArgs: -v / --version set version", () => {
  assert.equal(parseArgs(["-v"]).version, true);
  assert.equal(parseArgs(["--version"]).version, true);
});

test("parseArgs: --no-color combined with URL", () => {
  const r = parseArgs(["--no-color", "https://x.example/"]);
  assert.equal(r.noColor, true);
  assert.equal(r.url, "https://x.example/");
});

test("parseArgs: first non-flag wins as URL", () => {
  const r = parseArgs(["https://first/", "https://second/"]);
  assert.equal(r.url, "https://first/");
});

test("parseArgs: empty argv yields defaults", () => {
  assert.deepEqual(parseArgs([]), { url: null, help: false, version: false, noColor: false });
});

test("normalizeUrl: prefixes https:// when scheme missing", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com");
});

test("normalizeUrl: keeps http:// scheme intact", () => {
  assert.equal(normalizeUrl("http://example.com"), "http://example.com");
});

test("normalizeUrl: keeps https:// scheme intact", () => {
  assert.equal(normalizeUrl("https://example.com"), "https://example.com");
});
