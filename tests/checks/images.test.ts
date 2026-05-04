import { test } from "node:test";
import assert from "node:assert/strict";
import { imagesCheck } from "../../src/checks/images.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

const wrap = (body: string) => `<!DOCTYPE html><html><body>${body}</body></html>`;

test("no images → info, returns early", () => {
  const fs = imagesCheck(makeContext({ html: wrap("") })) as Finding[];
  assert.equal(find(fs, "Images")?.status, "info");
  assert.equal(fs.length, 1);
});

test("missing alt attribute → fail", () => {
  const fs = imagesCheck(makeContext({ html: wrap('<img src="logo.png">') })) as Finding[];
  assert.equal(find(fs, "Alt attributes")?.status, "fail");
});

test("all images have alt → ok", () => {
  const fs = imagesCheck(makeContext({
    html: wrap('<img src="hero.png" alt="A friendly developer reading docs">'),
  })) as Finding[];
  assert.equal(find(fs, "Alt attributes")?.status, "ok");
});

test("filename-like alt → suspicious warn", () => {
  const fs = imagesCheck(makeContext({
    html: wrap('<img src="logo.png" alt="logo.png">'),
  })) as Finding[];
  assert.equal(find(fs, "Alt quality")?.status, "warn");
});

test("very short alt (≤ 2 chars) → suspicious warn", () => {
  const fs = imagesCheck(makeContext({
    html: wrap('<img src="hero.png" alt="hi">'),
  })) as Finding[];
  assert.equal(find(fs, "Alt quality")?.status, "warn");
});

test("decorative empty alt → info", () => {
  const fs = imagesCheck(makeContext({
    html: wrap('<img src="bg.png" alt="">'),
  })) as Finding[];
  assert.equal(find(fs, "Decorative images")?.status, "info");
});

test("plausible alts only → ok on Alt quality", () => {
  const fs = imagesCheck(makeContext({
    html: wrap('<img src="hero.png" alt="A useful descriptive caption">'),
  })) as Finding[];
  assert.equal(find(fs, "Alt quality")?.status, "ok");
});
