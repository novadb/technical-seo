import type { AuditContext, Check, Finding } from "../types.js";
import { probeUrl, type ProbeResult } from "../fetcher.js";

const BCP47 = /^(x-default|[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2,3}|\d{3}))?)$/;
const REACHABILITY_CONCURRENCY = 6;

interface HreflangEntry {
  lang: string;
  href: string;
  source: "html" | "header";
}

export const hreflangCheck: Check = async (ctx: AuditContext): Promise<Finding[]> => {
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
      });
    } else {
      findings.push({
        status: "ok", category: cat, name: "Hreflang",
        message: "No hreflang – single-language site, OK",
      });
    }
    return findings;
  }

  findings.push({
    status: "info", category: cat, name: "Hreflang found",
    message: `${entries.length} entries (${entries.filter((e) => e.source === "html").length} HTML / ${entries.filter((e) => e.source === "header").length} header)`,
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
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Hreflang absolute",
      message: "All hreflang hrefs are absolute URLs",
    });
  }

  // BCP-47
  const invalid = entries.filter((e) => !BCP47.test(e.lang));
  if (invalid.length > 0) {
    findings.push({
      status: "fail", category: cat, name: "BCP-47 codes",
      message: `Invalid codes: ${invalid.map((e) => e.lang).join(", ")}`,
      fix: "Use codes like de, en-US, x-default",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "BCP-47 codes",
      message: "All codes look valid",
    });
  }

  // x-default
  const hasXDefault = entries.some((e) => e.lang.toLowerCase() === "x-default");
  if (entries.length > 1) {
    if (hasXDefault) {
      findings.push({
        status: "ok", category: cat, name: "x-default",
        message: "Present",
      });
    } else {
      findings.push({
        status: "warn", category: cat, name: "x-default",
        message: "Missing while multiple hreflang entries exist",
        fix: "Add an x-default entry for languages not otherwise covered",
      });
    }
  }

  // Self-reference
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  const selfTargets = [ctx.finalUrl, canonical].filter(Boolean) as string[];
  const hasSelf = entries.some((e) => selfTargets.some((t) => sameUrl(e.href, t)));
  findings.push({
    status: hasSelf ? "ok" : "fail",
    category: cat, name: "Self-reference",
    message: hasSelf
      ? "Current page is included in the hreflang set"
      : "Current page does not reference itself in the hreflang set",
    fix: hasSelf ? undefined : "Add a hreflang entry for the current URL",
  });

  // Reachability — HEAD every absolute href (deduplicated)
  const reachabilityFinding = await checkReachability(entries, cat);
  if (reachabilityFinding) findings.push(reachabilityFinding);

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
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Duplicates",
      message: "No duplicate codes",
    });
  }

  return findings;
};

async function checkReachability(
  entries: HreflangEntry[],
  cat: "Hreflang",
): Promise<Finding | null> {
  const urls = [...new Set(entries
    .map((e) => e.href)
    .filter((h) => /^https?:\/\//i.test(h)))];
  if (urls.length === 0) return null;

  const results = new Map<string, ProbeResult>();
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < urls.length) {
      const i = cursor++;
      const u = urls[i];
      results.set(u, await probeUrl(u));
    }
  }
  const workers = Array.from({ length: Math.min(REACHABILITY_CONCURRENCY, urls.length) }, worker);
  await Promise.all(workers);

  const failed: { url: string; result: ProbeResult }[] = [];
  for (const [url, result] of results) {
    if (!result.ok) failed.push({ url, result });
  }

  if (failed.length === 0) {
    return {
      status: "ok", category: cat, name: "Reachability",
      message: `All ${urls.length} hreflang URL(s) reachable`,
    };
  }

  const sample = failed.slice(0, 5).map((f) => {
    const detail = f.result.status !== null ? `HTTP ${f.result.status}` : f.result.error ?? "unreachable";
    return `${f.url} (${detail})`;
  }).join("; ");
  const more = failed.length > 5 ? ` (+${failed.length - 5} more)` : "";
  return {
    status: "fail", category: cat, name: "Reachability",
    message: `${failed.length} of ${urls.length} hreflang URL(s) unreachable: ${sample}${more}`,
    fix: "Make sure every hreflang URL returns 2xx",
  };
}

function sameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
  } catch { return a === b; }
}
