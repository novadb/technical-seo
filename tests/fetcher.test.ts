import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRedirectChain } from "../src/fetcher.js";
import { mockFetch, type FetchMock } from "./helpers/fetch-mock.js";

let mock: FetchMock | null = null;

afterEach(() => {
  mock?.restore();
  mock = null;
});

test("200 OK without redirects returns same input/final URL", async () => {
  mock = mockFetch([
    { status: 200, headers: { "content-type": "text/html" }, body: "<html></html>" },
  ]);
  const r = await fetchWithRedirectChain("https://example.com/");
  assert.equal(r.status, 200);
  assert.equal(r.inputUrl, "https://example.com/");
  assert.equal(r.finalUrl, "https://example.com/");
  assert.deepEqual(r.redirectChain, []);
  assert.equal(r.schemeDowngrade, false);
  assert.equal(r.rawHtml, "<html></html>");
});

test("single 301 redirect produces a one-hop chain", async () => {
  mock = mockFetch([
    { status: 301, headers: { location: "https://example.com/final" } },
    { status: 200, body: "ok" },
  ]);
  const r = await fetchWithRedirectChain("https://example.com/");
  assert.equal(r.redirectChain.length, 1);
  assert.equal(r.redirectChain[0].status, 301);
  assert.equal(r.redirectChain[0].url, "https://example.com/");
  assert.equal(r.redirectChain[0].location, "https://example.com/final");
  assert.equal(r.finalUrl, "https://example.com/final");
});

test("multiple hops are recorded in order, relative Locations resolve", async () => {
  mock = mockFetch([
    { status: 301, headers: { location: "/step2" } },
    { status: 302, headers: { location: "https://example.com/step3" } },
    { status: 200, body: "done" },
  ]);
  const r = await fetchWithRedirectChain("https://example.com/start");
  assert.equal(r.redirectChain.length, 2);
  assert.equal(r.redirectChain[0].location, "https://example.com/step2");
  assert.equal(r.redirectChain[1].location, "https://example.com/step3");
  assert.equal(r.finalUrl, "https://example.com/step3");
});

test("https → http redirect sets schemeDowngrade", async () => {
  mock = mockFetch([
    { status: 301, headers: { location: "http://example.com/legacy" } },
    { status: 200, body: "" },
  ]);
  const r = await fetchWithRedirectChain("https://example.com/");
  assert.equal(r.schemeDowngrade, true);
  assert.equal(r.finalUrl, "http://example.com/legacy");
});

test("more than 10 hops throws", async () => {
  mock = mockFetch(
    Array.from({ length: 11 }, (_, i) => ({
      status: 301,
      headers: { location: `https://example.com/${i + 1}` },
    })),
  );
  await assert.rejects(
    () => fetchWithRedirectChain("https://example.com/"),
    /Too many redirects/,
  );
});
