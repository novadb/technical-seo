import { test } from "node:test";
import assert from "node:assert/strict";
import { headingsCheck } from "../../src/checks/headings.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

const wrap = (body: string) => `<!DOCTYPE html><html><head><title>x</title></head><body>${body}</body></html>`;

test("no H1 → fail", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h2>Hi</h2>") })) as Finding[];
  assert.equal(find(fs, "H1 present")?.status, "fail");
});

test("exactly one H1 → ok", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>Hi</h1>") })) as Finding[];
  assert.equal(find(fs, "H1 present")?.status, "ok");
});

test("multiple H1 → fail", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>A</h1><h1>B</h1>") })) as Finding[];
  assert.equal(find(fs, "H1 present")?.status, "fail");
});

test("empty H1 → fail on 'H1 not empty'", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1></h1>") })) as Finding[];
  assert.equal(find(fs, "H1 not empty")?.status, "fail");
});

test("non-empty H1 → ok on 'H1 not empty'", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>Hello</h1>") })) as Finding[];
  assert.equal(find(fs, "H1 not empty")?.status, "ok");
});

test("hierarchy skip h1→h3 → warn", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>A</h1><h3>C</h3>") })) as Finding[];
  assert.equal(find(fs, "Heading hierarchy")?.status, "warn");
});

test("contiguous hierarchy h1→h2→h3 → ok", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>A</h1><h2>B</h2><h3>C</h3>") })) as Finding[];
  assert.equal(find(fs, "Heading hierarchy")?.status, "ok");
});

test("more than 15 headings → warn on count", () => {
  const body = Array.from({ length: 16 }, (_, i) => `<h${(i % 6) + 1}>h</h${(i % 6) + 1}>`).join("");
  const fs = headingsCheck(makeContext({ html: wrap(body) })) as Finding[];
  assert.equal(find(fs, "Heading count")?.status, "warn");
});

test("≤ 15 headings → info on count", () => {
  const fs = headingsCheck(makeContext({ html: wrap("<h1>A</h1><h2>B</h2>") })) as Finding[];
  assert.equal(find(fs, "Heading count")?.status, "info");
});
