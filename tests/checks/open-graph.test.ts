import { test } from "node:test";
import assert from "node:assert/strict";
import { openGraphCheck } from "../../src/checks/open-graph.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

function ogPage(meta: Record<string, string> = {}, extraHead = "", lang = "en"): string {
  const tags = Object.entries(meta)
    .map(([k, v]) => `<meta property="${k}" content="${v}">`)
    .join("");
  return `<!DOCTYPE html><html lang="${lang}"><head>${tags}${extraHead}</head></html>`;
}

test("og:title missing → fail", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:title")?.status, "fail");
});

test("og:description missing → fail", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:description")?.status, "fail");
});

test("og:image missing → fail", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:image")?.status, "fail");
});

test("og:image relative URL → warn", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:image": "/img.png" }),
  })) as Finding[];
  assert.equal(find(fs, "og:image")?.status, "warn");
});

test("og:image absolute URL → ok", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:image": "https://example.com/img.png" }),
  })) as Finding[];
  assert.equal(find(fs, "og:image")?.status, "ok");
});

test("og:url not set → warn (recommended)", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:url")?.status, "warn");
});

test("og:type not set → warn (recommended)", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:type")?.status, "warn");
});

test("og:locale not set → info", () => {
  const fs = openGraphCheck(makeContext({ html: ogPage({}) })) as Finding[];
  assert.equal(find(fs, "og:locale")?.status, "info");
});

test("og:url ≠ canonical → warn", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:url": "https://example.com/a" }, '<link rel="canonical" href="https://example.com/b">'),
  })) as Finding[];
  assert.equal(find(fs, "og:url vs canonical")?.status, "warn");
});

test("og:url == canonical → no mismatch finding", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:url": "https://example.com/a" }, '<link rel="canonical" href="https://example.com/a">'),
  })) as Finding[];
  assert.equal(find(fs, "og:url vs canonical"), undefined);
});

test("og:locale ≠ html lang base → warn", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:locale": "fr_FR" }, "", "de"),
  })) as Finding[];
  assert.equal(find(fs, "og:locale vs html lang")?.status, "warn");
});

test("og:locale == html lang base → no mismatch finding", () => {
  const fs = openGraphCheck(makeContext({
    html: ogPage({ "og:locale": "en_US" }, "", "en"),
  })) as Finding[];
  assert.equal(find(fs, "og:locale vs html lang"), undefined);
});
