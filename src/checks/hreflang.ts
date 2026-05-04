import type { AuditContext, Check, Finding } from "../types.js";

const BCP47 = /^(x-default|[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2,3}|\d{3}))?)$/;

interface HreflangEntry {
  lang: string;
  href: string;
  source: "html" | "header";
}

export const hreflangCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Hreflang" as const;
  const $ = ctx.$;

  const entries: HreflangEntry[] = [];

  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = ($(el).attr("hreflang") ?? "").trim();
    const href = ($(el).attr("href") ?? "").trim();
    if (lang && href) entries.push({ lang, href, source: "html" });
  });

  for (const link of ctx.linkHeader) {
    const rel = (link.params["rel"] ?? "").toLowerCase().split(/\s+/);
    if (!rel.includes("alternate")) continue;
    const lang = link.params["hreflang"];
    if (!lang) continue;
    entries.push({ lang, href: link.url, source: "header" });
  }

  if (entries.length === 0) {
    if (ctx.htmlLang && /-/.test(ctx.htmlLang)) {
      findings.push({
        status: "warn", category: cat, name: "Hreflang",
        message: `html lang is set to ${ctx.htmlLang}, but no hreflang tags`,
        fix: "Add hreflang tags for multilingual sites",
        priority: "medium",
      });
    } else {
      findings.push({
        status: "ok", category: cat, name: "Hreflang",
        message: "No hreflang – single-language site, OK",
        priority: "low",
      });
    }
    return findings;
  }

  findings.push({
    status: "info", category: cat, name: "Hreflang found",
    message: `${entries.length} entries (${entries.filter((e) => e.source === "html").length} HTML / ${entries.filter((e) => e.source === "header").length} header)`,
    priority: "info",
  });

  // Absolute URLs
  const relative: HreflangEntry[] = [];
  for (const e of entries) {
    if (!/^https?:\/\//i.test(e.href)) relative.push(e);
  }
  if (relative.length > 0) {
    findings.push({
      status: "fail", category: cat, name: "Hreflang absolute",
      message: `${relative.length} entries with relative href`,
      fix: "Use fully-qualified absolute URLs",
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Hreflang absolute",
      message: "All hreflang hrefs are absolute URLs",
      priority: "high",
    });
  }

  // BCP-47
  const invalid = entries.filter((e) => !BCP47.test(e.lang));
  if (invalid.length > 0) {
    findings.push({
      status: "fail", category: cat, name: "BCP-47 codes",
      message: `Invalid codes: ${invalid.map((e) => e.lang).join(", ")}`,
      fix: "Use codes like de, en-US, x-default",
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "BCP-47 codes",
      message: "All codes look valid",
      priority: "high",
    });
  }

  // x-default
  const hasXDefault = entries.some((e) => e.lang.toLowerCase() === "x-default");
  if (entries.length > 1) {
    if (hasXDefault) {
      findings.push({
        status: "ok", category: cat, name: "x-default",
        message: "Present", priority: "medium",
      });
    } else {
      findings.push({
        status: "warn", category: cat, name: "x-default",
        message: "Missing while multiple hreflang entries exist",
        fix: "Add an x-default entry for languages not otherwise covered",
        priority: "medium",
      });
    }
  }

  // Self-reference
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  const selfTargets = [ctx.finalUrl, canonical].filter(Boolean) as string[];
  const hasSelf = entries.some((e) => selfTargets.some((t) => sameUrl(e.href, t)));
  findings.push({
    status: hasSelf ? "ok" : "warn",
    category: cat, name: "Self-reference",
    message: hasSelf
      ? "Current page is included in the hreflang set"
      : "Current page does not reference itself in the hreflang set",
    fix: hasSelf ? undefined : "Add a hreflang entry for the current URL",
    priority: "medium",
  });

  // Duplicates
  const seen = new Map<string, number>();
  for (const e of entries) {
    const k = e.lang.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (dups.length > 0) {
    findings.push({
      status: "warn", category: cat, name: "Duplicates",
      message: `Codes used multiple times: ${dups.join(", ")}`,
      fix: "Use each hreflang code only once",
      priority: "medium",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Duplicates",
      message: "No duplicate codes",
      priority: "medium",
    });
  }

  return findings;
};

function sameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
  } catch { return a === b; }
}
