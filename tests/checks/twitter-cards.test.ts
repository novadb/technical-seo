import { test } from "node:test";
import assert from "node:assert/strict";
import { twitterCardsCheck } from "../../src/checks/twitter-cards.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

function twPage(meta: Record<string, string> = {}): string {
  const tags = Object.entries(meta)
    .map(([k, v]) => `<meta name="${k}" content="${v}">`)
    .join("");
  return `<!DOCTYPE html><html><head>${tags}</head></html>`;
}

test("twitter:card missing → fail", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({}) })) as Finding[];
  assert.equal(find(fs, "twitter:card")?.status, "fail");
});

test("twitter:card invalid type → warn", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({ "twitter:card": "unknown" }) })) as Finding[];
  assert.equal(find(fs, "twitter:card")?.status, "warn");
});

test("twitter:card valid type → ok", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({ "twitter:card": "summary_large_image" }) })) as Finding[];
  assert.equal(find(fs, "twitter:card")?.status, "ok");
});

test("twitter:title missing → warn", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({}) })) as Finding[];
  assert.equal(find(fs, "twitter:title")?.status, "warn");
});

test("twitter:description missing → warn", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({}) })) as Finding[];
  assert.equal(find(fs, "twitter:description")?.status, "warn");
});

test("twitter:image missing → warn", () => {
  const fs = twitterCardsCheck(makeContext({ html: twPage({}) })) as Finding[];
  assert.equal(find(fs, "twitter:image")?.status, "warn");
});

test("all twitter tags present → ok", () => {
  const fs = twitterCardsCheck(makeContext({
    html: twPage({
      "twitter:card": "summary",
      "twitter:title": "T",
      "twitter:description": "D",
      "twitter:image": "https://example.com/i.png",
    }),
  })) as Finding[];
  assert.equal(find(fs, "twitter:title")?.status, "ok");
  assert.equal(find(fs, "twitter:description")?.status, "ok");
  assert.equal(find(fs, "twitter:image")?.status, "ok");
});
