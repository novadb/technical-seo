import { test } from "node:test";
import assert from "node:assert/strict";
import { hreflangCheck } from "../../src/checks/hreflang.js";
import { makeContext } from "../helpers/context.js";
import type { Finding } from "../../src/types.js";

const find = (fs: Finding[], name: string) => fs.find((f) => f.name === name);

function pageWithLinks(links: Array<{ lang: string; href: string }>, lang = "en", canonical?: string): string {
  const tags = links.map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${l.href}">`).join("");
  const can = canonical ? `<link rel="canonical" href="${canonical}">` : "";
  return `<!DOCTYPE html><html lang="${lang}"><head>${can}${tags}</head></html>`;
}

test("no entries + single-language site → ok", () => {
  const fs = hreflangCheck(makeContext({ html: pageWithLinks([], "en") })) as Finding[];
  assert.equal(find(fs, "Hreflang")?.status, "ok");
});

test("no entries + multilingual html lang (de-DE) → warn", () => {
  const fs = hreflangCheck(makeContext({ html: pageWithLinks([], "de-DE") })) as Finding[];
  assert.equal(find(fs, "Hreflang")?.status, "warn");
});

test("relative hreflang href → fail", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([{ lang: "en", href: "/en/" }, { lang: "de", href: "/de/" }]),
  })) as Finding[];
  assert.equal(find(fs, "Hreflang absolute")?.status, "fail");
});

test("all absolute → ok", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "en", href: "https://example.com/en/" },
      { lang: "de", href: "https://example.com/de/" },
    ]),
    finalUrl: "https://example.com/en/",
  })) as Finding[];
  assert.equal(find(fs, "Hreflang absolute")?.status, "ok");
});

test("invalid BCP-47 codes → fail", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "ENGLISH", href: "https://example.com/" },
      { lang: "de", href: "https://example.com/de/" },
    ]),
  })) as Finding[];
  assert.equal(find(fs, "BCP-47 codes")?.status, "fail");
});

test("multiple entries without x-default → warn", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "en", href: "https://example.com/en/" },
      { lang: "de", href: "https://example.com/de/" },
    ]),
  })) as Finding[];
  assert.equal(find(fs, "x-default")?.status, "warn");
});

test("x-default present → ok", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "en", href: "https://example.com/en/" },
      { lang: "de", href: "https://example.com/de/" },
      { lang: "x-default", href: "https://example.com/" },
    ]),
  })) as Finding[];
  assert.equal(find(fs, "x-default")?.status, "ok");
});

test("self-reference present → ok", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "en", href: "https://example.com/en/" },
      { lang: "de", href: "https://example.com/de/" },
    ]),
    finalUrl: "https://example.com/en/",
  })) as Finding[];
  assert.equal(find(fs, "Self-reference")?.status, "ok");
});

test("self-reference missing → warn", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "fr", href: "https://example.com/fr/" },
      { lang: "de", href: "https://example.com/de/" },
    ]),
    finalUrl: "https://example.com/en/",
  })) as Finding[];
  assert.equal(find(fs, "Self-reference")?.status, "warn");
});

test("duplicate hreflang codes → warn", () => {
  const fs = hreflangCheck(makeContext({
    html: pageWithLinks([
      { lang: "en", href: "https://example.com/en/" },
      { lang: "en", href: "https://example.com/en2/" },
    ]),
  })) as Finding[];
  assert.equal(find(fs, "Duplicates")?.status, "warn");
});
