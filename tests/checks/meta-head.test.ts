import { test } from "node:test";
import assert from "node:assert/strict";
import { metaHeadCheck } from "../../src/checks/meta-head.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);
const findAll = (fs: Finding[], name: string) => fs.filter((f) => f.name === name);

function page(opts: {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  robots?: string;
  charset?: string | null;
  viewport?: string | null;
  lang?: string | null;
} = {}): string {
  const head: string[] = [];
  if (opts.charset !== null) head.push(`<meta charset="${opts.charset ?? "UTF-8"}">`);
  if (opts.viewport !== null) head.push(`<meta name="viewport" content="${opts.viewport ?? "width=device-width, initial-scale=1"}">`);
  if (opts.title !== undefined) head.push(`<title>${opts.title}</title>`);
  if (opts.description !== undefined) head.push(`<meta name="description" content="${opts.description}">`);
  if (opts.keywords) head.push(`<meta name="keywords" content="${opts.keywords}">`);
  if (opts.canonical) head.push(`<link rel="canonical" href="${opts.canonical}">`);
  if (opts.robots) head.push(`<meta name="robots" content="${opts.robots}">`);
  const langAttr = opts.lang === null ? "" : ` lang="${opts.lang ?? "en"}"`;
  return `<!DOCTYPE html><html${langAttr}><head>${head.join("")}</head></html>`;
}

// Title
test("title missing → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({}) })) as Finding[];
  assert.equal(find(fs, "Title")?.status, "fail");
});

test("title length 55 (ideal) → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55) }) })) as Finding[];
  assert.equal(find(fs, "Title length")?.status, "ok");
});

test("title length 45 (within tolerance) → warn", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(45) }) })) as Finding[];
  assert.equal(find(fs, "Title length")?.status, "warn");
});

test("title length 75 (well outside) → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(75) }) })) as Finding[];
  assert.equal(find(fs, "Title length")?.status, "fail");
});

// Description
test("description missing → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55) }) })) as Finding[];
  assert.equal(find(fs, "Meta Description")?.status, "fail");
});

test("description length 155 (ideal) → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55), description: "a".repeat(155) }) })) as Finding[];
  assert.equal(find(fs, "Description length")?.status, "ok");
});

test("description length 130 (within tolerance) → warn", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55), description: "a".repeat(130) }) })) as Finding[];
  assert.equal(find(fs, "Description length")?.status, "warn");
});

test("description length 200 (well outside) → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55), description: "a".repeat(200) }) })) as Finding[];
  assert.equal(find(fs, "Description length")?.status, "fail");
});

// Keywords
test("keywords present → info", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ keywords: "seo, web" }) })) as Finding[];
  assert.equal(find(fs, "Meta Keywords")?.status, "info");
});

// html lang
test("html lang missing → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ lang: null }) })) as Finding[];
  assert.equal(find(fs, "html lang")?.status, "fail");
});

test("html lang invalid BCP-47 → warn", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ lang: "XX-yy" }) })) as Finding[];
  assert.equal(find(fs, "html lang")?.status, "warn");
});

test("html lang de-DE → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ lang: "de-DE" }) })) as Finding[];
  assert.equal(find(fs, "html lang")?.status, "ok");
});

// Canonical
test("no canonical at all → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({}) })) as Finding[];
  assert.equal(find(fs, "Canonical")?.status, "fail");
});

test("canonical HTML matches finalUrl → ok (self-ref)", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({ canonical: "https://example.com/page" }),
    finalUrl: "https://example.com/page",
  })) as Finding[];
  assert.equal(find(fs, "Canonical")?.status, "ok");
});

test("canonical HTML differs from finalUrl → warn", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({ canonical: "https://other.example/" }),
    finalUrl: "https://example.com/page",
  })) as Finding[];
  assert.equal(find(fs, "Canonical")?.status, "warn");
});

test("canonical via Link header only → ok if matches", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({}),
    finalUrl: "https://example.com/page",
    headers: {
      "content-type": "text/html; charset=utf-8",
      link: '<https://example.com/page>; rel="canonical"',
    },
  })) as Finding[];
  assert.equal(find(fs, "Canonical")?.status, "ok");
});

test("canonical HTML and Link header conflict → fail", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({ canonical: "https://example.com/a" }),
    finalUrl: "https://example.com/a",
    headers: {
      "content-type": "text/html; charset=utf-8",
      link: '<https://example.com/b>; rel="canonical"',
    },
  })) as Finding[];
  assert.equal(find(fs, "Canonical conflict")?.status, "fail");
});

test("canonical HTML and Link header agree → no conflict finding", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({ canonical: "https://example.com/page" }),
    finalUrl: "https://example.com/page",
    headers: {
      "content-type": "text/html; charset=utf-8",
      link: '<https://example.com/page>; rel="canonical"',
    },
  })) as Finding[];
  assert.equal(find(fs, "Canonical conflict"), undefined);
});

// Robots
test("no robots → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({}) })) as Finding[];
  assert.equal(find(fs, "Robots directives")?.status, "ok");
});

test("meta robots noindex → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ robots: "noindex,nofollow" }) })) as Finding[];
  assert.equal(find(fs, "Robots directives")?.status, "fail");
});

test("X-Robots-Tag header noindex → fail", () => {
  const fs = metaHeadCheck(makeContext({
    html: page({}),
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  })) as Finding[];
  assert.equal(find(fs, "Robots directives")?.status, "fail");
});

test("non-restrictive robots directive → info", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ robots: "max-snippet:0" }) })) as Finding[];
  assert.equal(find(fs, "Robots directives")?.status, "info");
});

// Charset meta
test("charset meta missing → warn", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ charset: null }) })) as Finding[];
  assert.equal(find(fs, "Charset meta")?.status, "warn");
});

test("charset meta non-utf8 → warn", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ charset: "iso-8859-1" }) })) as Finding[];
  assert.equal(find(fs, "Charset meta")?.status, "warn");
});

test("charset meta UTF-8 → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ charset: "UTF-8" }) })) as Finding[];
  assert.equal(find(fs, "Charset meta")?.status, "ok");
});

// Viewport
test("viewport missing → fail", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ viewport: null }) })) as Finding[];
  assert.equal(find(fs, "Viewport")?.status, "fail");
});

test("viewport present → ok", () => {
  const fs = metaHeadCheck(makeContext({ html: page({}) })) as Finding[];
  assert.equal(find(fs, "Viewport")?.status, "ok");
});

// Sanity: title-present finding shows up alongside length finding
test("title present yields both 'Title present' and 'Title length' findings", () => {
  const fs = metaHeadCheck(makeContext({ html: page({ title: "a".repeat(55) }) })) as Finding[];
  assert.equal(find(fs, "Title present")?.status, "ok");
  assert.equal(findAll(fs, "Title").length, 0);
});
