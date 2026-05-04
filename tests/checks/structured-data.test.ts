import { test } from "node:test";
import assert from "node:assert/strict";
import { structuredDataCheck } from "../../src/checks/structured-data.js";
import { makeContext } from "../helpers/context.js";
import { loadFixture } from "../helpers/fixture.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

const wrap = (head: string) => `<!DOCTYPE html><html><head>${head}</head></html>`;
const ld = (json: string) => `<script type="application/ld+json">${json}</script>`;

test("no JSON-LD blocks → warn, returns early", () => {
  const fs = structuredDataCheck(makeContext({ html: wrap("") })) as Finding[];
  assert.equal(find(fs, "JSON-LD")?.status, "warn");
  assert.equal(fs.length, 1);
});

test("invalid JSON → fail on parsing", () => {
  const fs = structuredDataCheck(makeContext({
    html: wrap(ld("{ this is not valid json")),
  })) as Finding[];
  assert.equal(find(fs, "JSON-LD Parsing")?.status, "fail");
});

test("Article with all required fields → no missing-fields warn", () => {
  const fs = structuredDataCheck(makeContext({
    html: wrap(ld(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "H",
      author: "A",
      datePublished: "2026-01-01",
    }))),
  })) as Finding[];
  assert.equal(find(fs, "Article – required fields"), undefined);
  assert.equal(find(fs, "JSON-LD Parsing")?.status, "ok");
});

test("Article missing fields → warn", () => {
  const fs = structuredDataCheck(makeContext({
    html: wrap(ld(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "H",
    }))),
  })) as Finding[];
  assert.equal(find(fs, "Article – required fields")?.status, "warn");
});

test("Product missing image → warn", () => {
  const fs = structuredDataCheck(makeContext({
    html: wrap(ld(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Widget",
    }))),
  })) as Finding[];
  assert.equal(find(fs, "Product – required fields")?.status, "warn");
});

test("@graph: collects multiple types via fixture", () => {
  const fs = structuredDataCheck(makeContext({ html: loadFixture("structured-data") })) as Finding[];
  const detection = find(fs, "@type detection");
  assert.equal(detection?.status, "info");
  for (const t of ["Organization", "WebSite", "BreadcrumbList", "Product"]) {
    assert.ok(detection?.message.includes(t), `expected ${t} in: ${detection?.message}`);
  }
});
