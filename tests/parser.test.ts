import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditContext } from "../src/parser.js";
import type { FetchResult } from "../src/types.js";

function fetched(html: string, headers: Record<string, string> = {}): FetchResult {
  return {
    inputUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    redirectChain: [],
    status: 200,
    headers: new Headers(headers),
    rawHtml: html,
    schemeDowngrade: false,
  };
}

test("charsetFromHeader: parsed from Content-Type", () => {
  const ctx = buildAuditContext(fetched("<html></html>", {
    "content-type": "text/html; charset=utf-8",
  }));
  assert.equal(ctx.charsetFromHeader, "utf-8");
});

test("charsetFromHeader: handles quoted value", () => {
  const ctx = buildAuditContext(fetched("<html></html>", {
    "content-type": 'text/html; charset="ISO-8859-1"',
  }));
  assert.equal(ctx.charsetFromHeader, "ISO-8859-1");
});

test("charsetFromHeader: null when missing", () => {
  const ctx = buildAuditContext(fetched("<html></html>", { "content-type": "text/html" }));
  assert.equal(ctx.charsetFromHeader, null);
});

test("charsetFromMeta: read from <meta charset>", () => {
  const ctx = buildAuditContext(fetched(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head></html>`));
  assert.equal(ctx.charsetFromMeta, "UTF-8");
});

test("metaRefresh: parses seconds + url", () => {
  const ctx = buildAuditContext(fetched(
    `<html><head><meta http-equiv="refresh" content="5; url=https://x.example/"></head></html>`,
  ));
  assert.deepEqual(ctx.metaRefresh, { seconds: 5, url: "https://x.example/" });
});

test("metaRefresh: seconds only, empty url", () => {
  const ctx = buildAuditContext(fetched(
    `<html><head><meta http-equiv="refresh" content="3"></head></html>`,
  ));
  assert.deepEqual(ctx.metaRefresh, { seconds: 3, url: "" });
});

test("metaRefresh: missing returns null", () => {
  const ctx = buildAuditContext(fetched(`<html><head></head></html>`));
  assert.equal(ctx.metaRefresh, null);
});

test("metaRefresh: malformed content returns zeroed entry", () => {
  const ctx = buildAuditContext(fetched(
    `<html><head><meta http-equiv="refresh" content="garbage"></head></html>`,
  ));
  assert.deepEqual(ctx.metaRefresh, { seconds: 0, url: "" });
});

test("linkHeader: single entry with rel param", () => {
  const ctx = buildAuditContext(fetched("<html></html>", {
    link: '<https://example.com/>; rel="canonical"',
  }));
  assert.equal(ctx.linkHeader.length, 1);
  assert.equal(ctx.linkHeader[0].url, "https://example.com/");
  assert.equal(ctx.linkHeader[0].params.rel, "canonical");
});

test("linkHeader: multiple comma-separated entries", () => {
  const ctx = buildAuditContext(fetched("<html></html>", {
    link: '<https://a/>; rel="canonical", <https://b/>; rel="alternate"; hreflang="de"',
  }));
  assert.equal(ctx.linkHeader.length, 2);
  assert.equal(ctx.linkHeader[0].params.rel, "canonical");
  assert.equal(ctx.linkHeader[1].params.hreflang, "de");
});

test("linkHeader: comma inside <> does not split", () => {
  const ctx = buildAuditContext(fetched("<html></html>", {
    link: '<https://example.com/path,with,commas>; rel="canonical"',
  }));
  assert.equal(ctx.linkHeader.length, 1);
  assert.equal(ctx.linkHeader[0].url, "https://example.com/path,with,commas");
});

test("htmlLang: extracted from <html lang>", () => {
  const ctx = buildAuditContext(fetched(`<!DOCTYPE html><html lang="de-DE"></html>`));
  assert.equal(ctx.htmlLang, "de-DE");
});

test("htmlLang: null when missing", () => {
  const ctx = buildAuditContext(fetched(`<!DOCTYPE html><html></html>`));
  assert.equal(ctx.htmlLang, null);
});
