import { test } from "node:test";
import assert from "node:assert/strict";
import { linksCheck } from "../../src/checks/links.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

const wrap = (body: string) => `<!DOCTYPE html><html><body>${body}</body></html>`;

test("no anchors → warn, returns early", () => {
  const fs = linksCheck(makeContext({ html: wrap("") })) as Finding[];
  assert.equal(find(fs, "Links")?.status, "warn");
  assert.equal(fs.length, 1);
});

test("only internal links → ok", () => {
  const fs = linksCheck(makeContext({
    html: wrap('<a href="/a">A</a><a href="/b">B</a>'),
    finalUrl: "https://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "Internal links")?.status, "ok");
});

test("only external links → warn (no internal)", () => {
  const fs = linksCheck(makeContext({
    html: wrap('<a href="https://other.example/">x</a>'),
    finalUrl: "https://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "Internal links")?.status, "warn");
});

test("mixed + empty href + hash-only → empty-targets warn", () => {
  const fs = linksCheck(makeContext({
    html: wrap('<a href="/a">A</a><a href="">B</a><a href="#">C</a>'),
    finalUrl: "https://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "Empty link targets")?.status, "warn");
  assert.equal(find(fs, "Internal links")?.status, "ok");
});
