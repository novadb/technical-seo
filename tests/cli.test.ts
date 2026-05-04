import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, normalizeUrl, CliError } from "../src/cli.js";

const DEFAULTS = {
  url: null,
  help: false,
  version: false,
  noColor: false,
  group: "category" as const,
  format: "pretty" as const,
  minPriority: null,
};

function snapshot(r: ReturnType<typeof parseArgs>) {
  return { ...r, hide: [...r.hide].sort() };
}

test("parseArgs: -h sets help", () => {
  assert.deepEqual(snapshot(parseArgs(["-h"])), { ...DEFAULTS, help: true, hide: [] });
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
  assert.deepEqual(snapshot(parseArgs([])), { ...DEFAULTS, hide: [] });
});

test("parseArgs: --group=priority", () => {
  assert.equal(parseArgs(["--group=priority"]).group, "priority");
});

test("parseArgs: --format=markdown", () => {
  assert.equal(parseArgs(["--format=markdown"]).format, "markdown");
});

test("parseArgs: --hide=ok,info parses to set", () => {
  const r = parseArgs(["--hide=ok,info"]);
  assert.deepEqual([...r.hide].sort(), ["info", "ok"]);
});

test("parseArgs: --min-priority=medium", () => {
  assert.equal(parseArgs(["--min-priority=medium"]).minPriority, "medium");
});

test("parseArgs: invalid --group throws CliError", () => {
  assert.throws(() => parseArgs(["--group=bogus"]), CliError);
});

test("parseArgs: invalid --hide value throws CliError", () => {
  assert.throws(() => parseArgs(["--hide=ok,nope"]), CliError);
});

test("parseArgs: invalid --min-priority throws CliError", () => {
  assert.throws(() => parseArgs(["--min-priority=urgent"]), CliError);
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
