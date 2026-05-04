import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, normalizeUrl, CliError } from "../src/cli.js";

const DEFAULTS = {
  url: null,
  help: false,
  version: false,
  noColor: false,
  group: "status" as const,
  format: "pretty" as const,
  show: "all" as const,
};

test("parseArgs: -h sets help", () => {
  assert.deepEqual(parseArgs(["-h"]), { ...DEFAULTS, help: true });
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
  assert.deepEqual(parseArgs([]), DEFAULTS);
});

test("parseArgs: --group=category", () => {
  assert.equal(parseArgs(["--group=category"]).group, "category");
});

test("parseArgs: --format=markdown", () => {
  assert.equal(parseArgs(["--format=markdown"]).format, "markdown");
});

test("parseArgs: --show=issues", () => {
  assert.equal(parseArgs(["--show=issues"]).show, "issues");
});

test("parseArgs: --show=fails", () => {
  assert.equal(parseArgs(["--show=fails"]).show, "fails");
});

test("parseArgs: invalid --group throws CliError", () => {
  assert.throws(() => parseArgs(["--group=bogus"]), CliError);
});

test("parseArgs: invalid --show throws CliError", () => {
  assert.throws(() => parseArgs(["--show=urgent"]), CliError);
});

test("parseArgs: unknown option throws CliError", () => {
  assert.throws(() => parseArgs(["--bogus"]), CliError);
  assert.throws(() => parseArgs(["--hide=ok"]), CliError);
  assert.throws(() => parseArgs(["--min-severity=fail"]), CliError);
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
