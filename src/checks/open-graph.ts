import type { AuditContext, Check, Finding } from "../types.js";

interface OgRule {
  prop: string;
  name: string;
  status: "fail" | "warn" | "info";
  required: boolean;
  validate?: (value: string) => string | null; // returns error message or null
}

const RULES: OgRule[] = [
  { prop: "og:title", name: "og:title", status: "fail", required: true },
  { prop: "og:description", name: "og:description", status: "fail", required: true },
  {
    prop: "og:image", name: "og:image", status: "fail", required: true,
    validate: (v) => /^https?:\/\//i.test(v) ? null : "URL is not absolute",
  },
  { prop: "og:url", name: "og:url", status: "warn", required: false },
  { prop: "og:type", name: "og:type", status: "warn", required: false },
  { prop: "og:locale", name: "og:locale", status: "info", required: false },
];

export const openGraphCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Open Graph" as const;
  const $ = ctx.$;

  for (const rule of RULES) {
    const value = $(`meta[property="${rule.prop}"]`).attr("content")?.trim()
      ?? $(`meta[name="${rule.prop}"]`).attr("content")?.trim()
      ?? "";
    if (!value) {
      findings.push({
        status: rule.required ? "fail" : rule.status,
        category: cat, name: rule.name,
        message: rule.required ? "Missing" : "Not set (recommended)",
        fix: `Add <meta property="${rule.prop}" content="…"> to <head>`,
      });
      continue;
    }
    const validationError = rule.validate?.(value);
    if (validationError) {
      findings.push({
        status: "warn", category: cat, name: rule.name,
        message: `${value} – ${validationError}`,
        fix: rule.prop === "og:image" ? "Use an absolute URL (https://…)" : undefined,
      });
      continue;
    }
    findings.push({
      status: "ok", category: cat, name: rule.name,
      message: truncate(value, 80),
    });
  }

  // og:url vs canonical
  const ogUrl = $('meta[property="og:url"]').attr("content")?.trim();
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  if (ogUrl && canonical && !sameUrl(ogUrl, canonical)) {
    findings.push({
      status: "warn", category: cat, name: "og:url vs canonical",
      message: `og:url (${ogUrl}) differs from canonical (${canonical})`,
      fix: "Keep og:url and canonical in sync",
    });
  }

  // og:locale vs html lang
  const ogLocale = $('meta[property="og:locale"]').attr("content")?.trim();
  if (ogLocale && ctx.htmlLang) {
    const ogBase = ogLocale.split(/[-_]/)[0].toLowerCase();
    const langBase = ctx.htmlLang.split("-")[0].toLowerCase();
    if (ogBase !== langBase) {
      findings.push({
        status: "warn", category: cat, name: "og:locale vs html lang",
        message: `og:locale (${ogLocale}) ≠ html lang (${ctx.htmlLang})`,
        fix: "Align the language declarations",
      });
    }
  }

  return findings;
};

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function sameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
  } catch { return a === b; }
}
