import { test } from "node:test";
import assert from "node:assert/strict";
import { httpResponseCheck } from "../../src/checks/http-response.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const HTML = "<html></html>";

function find(fs: Finding[], name: string): Finding | undefined {
  return fs.find((f) => f.name === name);
}

test("status 200 → ok", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, status: 200 })) as Finding[];
  assert.equal(find(fs, "HTTP status")?.status, "ok");
});

test("status 3xx final → fail", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, status: 301 })) as Finding[];
  assert.equal(find(fs, "HTTP status")?.status, "fail");
});

test("status 4xx → fail", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, status: 404 })) as Finding[];
  assert.equal(find(fs, "HTTP status")?.status, "fail");
});

test("status 5xx → fail", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, status: 503 })) as Finding[];
  assert.equal(find(fs, "HTTP status")?.status, "fail");
});

test("unusual status (between ranges) → warn", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, status: 250 })) as Finding[];
  assert.equal(find(fs, "HTTP status")?.status, "warn");
});

test("redirect chain empty → ok", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML })) as Finding[];
  assert.equal(find(fs, "Redirect chain")?.status, "ok");
});

test("single 301 → ok", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    redirectChain: [{ url: "https://a/", status: 301, location: "https://b/" }],
  })) as Finding[];
  assert.equal(find(fs, "Redirect chain")?.status, "ok");
});

test("302 in chain → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    redirectChain: [{ url: "https://a/", status: 302, location: "https://b/" }],
  })) as Finding[];
  assert.equal(find(fs, "Redirect chain")?.status, "warn");
});

test("multi-hop chain → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    redirectChain: [
      { url: "https://a/", status: 301, location: "https://b/" },
      { url: "https://b/", status: 301, location: "https://c/" },
    ],
  })) as Finding[];
  assert.equal(find(fs, "Redirect chain")?.status, "warn");
});

test("https → https → ok", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    inputUrl: "https://example.com/",
    finalUrl: "https://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "HTTPS")?.status, "ok");
});

test("http input → https final → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    inputUrl: "http://example.com/",
    finalUrl: "https://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "HTTPS")?.status, "warn");
});

test("final not https → fail", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    inputUrl: "http://example.com/",
    finalUrl: "http://example.com/",
  })) as Finding[];
  assert.equal(find(fs, "HTTPS")?.status, "fail");
});

test("schemeDowngrade flag → extra fail finding", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, schemeDowngrade: true })) as Finding[];
  assert.equal(find(fs, "Scheme downgrade")?.status, "fail");
});

test("Content-Type missing → warn", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML, headers: {} })) as Finding[];
  assert.equal(find(fs, "Content-Type")?.status, "warn");
});

test("Content-Type non-html → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML, headers: { "content-type": "application/json" },
  })) as Finding[];
  assert.equal(find(fs, "Content-Type")?.status, "warn");
});

test("Content-Type text/html → ok", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML, headers: { "content-type": "text/html; charset=utf-8" },
  })) as Finding[];
  assert.equal(find(fs, "Content-Type")?.status, "ok");
});

test("Charset header absent → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML, headers: { "content-type": "text/html" },
  })) as Finding[];
  assert.equal(find(fs, "Charset (header)")?.status, "warn");
});

test("Charset header non-utf8 → warn", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML, headers: { "content-type": "text/html; charset=iso-8859-1" },
  })) as Finding[];
  assert.equal(find(fs, "Charset (header)")?.status, "warn");
});

test("Charset header utf-8 → ok", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML, headers: { "content-type": "text/html; charset=utf-8" },
  })) as Finding[];
  assert.equal(find(fs, "Charset (header)")?.status, "ok");
});

test("Content-Encoding missing → warn", () => {
  const fs = httpResponseCheck(makeContext({ html: HTML })) as Finding[];
  assert.equal(find(fs, "Content-Encoding")?.status, "warn");
});

test("Content-Encoding gzip → ok", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" },
  })) as Finding[];
  assert.equal(find(fs, "Content-Encoding")?.status, "ok");
});

test("X-Robots-Tag noindex → fail", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" },
  })) as Finding[];
  assert.equal(find(fs, "X-Robots-Tag (header)")?.status, "fail");
});

test("X-Robots-Tag informational → info", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "max-snippet:0" },
  })) as Finding[];
  assert.equal(find(fs, "X-Robots-Tag (header)")?.status, "info");
});

test("Link header present → info", () => {
  const fs = httpResponseCheck(makeContext({
    html: HTML,
    headers: { "content-type": "text/html; charset=utf-8", link: '<https://x/>; rel="canonical"' },
  })) as Finding[];
  assert.equal(find(fs, "Link header")?.status, "info");
});
