import { test } from "node:test";
import assert from "node:assert/strict";
import { documentFoundationCheck } from "../../src/checks/document-foundation.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

test("HTML5 doctype → ok", () => {
  const fs = documentFoundationCheck(makeContext({ html: "<!DOCTYPE html><html></html>" })) as Finding[];
  assert.equal(find(fs, "HTML5 Doctype")?.status, "ok");
});

test("legacy doctype → warn", () => {
  const fs = documentFoundationCheck(makeContext({
    html: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"><html></html>',
  })) as Finding[];
  assert.equal(find(fs, "HTML5 Doctype")?.status, "warn");
});

test("missing doctype → fail", () => {
  const fs = documentFoundationCheck(makeContext({ html: "<html></html>" })) as Finding[];
  assert.equal(find(fs, "HTML5 Doctype")?.status, "fail");
});

test("meta refresh present → fail", () => {
  const fs = documentFoundationCheck(makeContext({
    html: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=https://x/"></head></html>`,
  })) as Finding[];
  assert.equal(find(fs, "Meta refresh")?.status, "fail");
});

test("no meta refresh → ok", () => {
  const fs = documentFoundationCheck(makeContext({ html: "<!DOCTYPE html><html></html>" })) as Finding[];
  assert.equal(find(fs, "Meta refresh")?.status, "ok");
});
