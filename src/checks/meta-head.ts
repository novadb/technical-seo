import type { AuditContext, Check, Finding } from "../types.js";

const BCP47 = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2,3}|\d{3}))?$/;

export const metaHeadCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Meta & Head" as const;
  const $ = ctx.$;

  // Title
  const title = $("title").first().text().trim();
  if (!title) {
    findings.push({
      status: "fail", category: cat, name: "Title",
      message: "No <title> or empty",
      fix: "Add a meaningful <title> of 50–60 characters",
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Title present",
      message: `"${truncate(title, 80)}"`,
      priority: "high",
    });
    const len = title.length;
    if (len >= 50 && len <= 60) {
      findings.push({
        status: "ok", category: cat, name: "Title length",
        message: `${len} characters (50–60 ideal)`,
        priority: "medium",
      });
    } else if (len >= 40 && len <= 70) {
      findings.push({
        status: "warn", category: cat, name: "Title length",
        message: `${len} characters – outside 50–60`,
        fix: "Shorten/extend to 50–60 characters",
        priority: "medium",
      });
    } else {
      findings.push({
        status: "fail", category: cat, name: "Title length",
        message: `${len} characters – well outside 50–60`,
        fix: "Rewrite title to 50–60 characters",
        priority: "medium",
      });
    }
  }

  // Description
  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!desc) {
    findings.push({
      status: "fail", category: cat, name: "Meta Description",
      message: "Completely missing",
      fix: 'Add <meta name="description" content="…"> to <head>, 150–160 characters',
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Meta Description present",
      message: `"${truncate(desc, 90)}"`,
      priority: "high",
    });
    const len = desc.length;
    if (len >= 150 && len <= 160) {
      findings.push({
        status: "ok", category: cat, name: "Description length",
        message: `${len} characters (150–160 ideal)`,
        priority: "medium",
      });
    } else if (len >= 120 && len <= 180) {
      findings.push({
        status: "warn", category: cat, name: "Description length",
        message: `${len} characters – outside 150–160`,
        fix: "Adjust to 150–160 characters",
        priority: "medium",
      });
    } else {
      findings.push({
        status: "fail", category: cat, name: "Description length",
        message: `${len} characters – well outside 150–160`,
        fix: "Rewrite the description, target 150–160 characters",
        priority: "medium",
      });
    }
  }

  // Keywords
  const keywords = $('meta[name="keywords"]').attr("content")?.trim();
  if (keywords) {
    findings.push({
      status: "info", category: cat, name: "Meta Keywords",
      message: `Present ("${truncate(keywords, 60)}") – ignored by Google`,
      priority: "low",
    });
  }

  // html lang
  const lang = ctx.htmlLang;
  if (!lang) {
    findings.push({
      status: "fail", category: cat, name: "html lang",
      message: "<html lang> attribute is missing",
      fix: 'Set the lang attribute, e.g. <html lang="en">',
      priority: "high",
    });
  } else if (!BCP47.test(lang)) {
    findings.push({
      status: "warn", category: cat, name: "html lang",
      message: `"${lang}" does not look like a BCP-47 code`,
      fix: "Check format, e.g. de, de-DE, en-US",
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "html lang",
      message: lang, priority: "high",
    });
  }

  // Canonical (HTML + Link header)
  const canonicalHtml = $('link[rel="canonical"]').attr("href")?.trim() ?? null;
  const canonicalHeader = ctx.linkHeader.find((e) =>
    (e.params["rel"] ?? "").toLowerCase().split(/\s+/).includes("canonical"),
  )?.url ?? null;

  if (!canonicalHtml && !canonicalHeader) {
    findings.push({
      status: "fail", category: cat, name: "Canonical",
      message: "Set neither in <head> nor in the Link header",
      fix: 'Add <link rel="canonical" href="…"> to <head>',
      priority: "high",
    });
  } else {
    if (canonicalHtml && canonicalHeader && canonicalHtml !== canonicalHeader) {
      findings.push({
        status: "fail", category: cat, name: "Canonical conflict",
        message: `HTML (${canonicalHtml}) and Link header (${canonicalHeader}) disagree`,
        fix: "Agree on a single consistent canonical URL",
        priority: "high",
      });
    }
    const canonical = canonicalHtml ?? canonicalHeader!;
    const matches = sameUrl(canonical, ctx.finalUrl);
    findings.push({
      status: matches ? "ok" : "warn",
      category: cat, name: "Canonical",
      message: matches
        ? `${canonical} (self-reference)`
        : `${canonical} (does not point to final URL ${ctx.finalUrl})`,
      fix: matches ? undefined : "Make sure this is intentional (e.g. pagination)",
      priority: "high",
    });
  }

  // Robots (HTML + X-Robots-Tag combined)
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() ?? "";
  const xRobotsHeader = ctx.headers.get("x-robots-tag") ?? "";
  const combined = [robotsMeta, xRobotsHeader].filter(Boolean).join(", ").toLowerCase();
  if (!combined) {
    findings.push({
      status: "ok", category: cat, name: "Robots directives",
      message: "No restrictive directives (implies index, follow)",
      priority: "high",
    });
  } else {
    const restrictive = /noindex|nofollow|none/.test(combined);
    findings.push({
      status: restrictive ? "fail" : "info",
      category: cat, name: "Robots directives",
      message: `${robotsMeta || "(no meta)"} | Header: ${xRobotsHeader || "(no header)"}`,
      fix: restrictive
        ? "Remove directives if the page should be indexed"
        : undefined,
      priority: restrictive ? "high" : "info",
    });
  }

  // Charset meta
  if (!ctx.charsetFromMeta) {
    findings.push({
      status: "warn", category: cat, name: "Charset meta",
      message: "<meta charset> is missing",
      fix: 'Place <meta charset="UTF-8"> as the first element in <head>',
      priority: "medium",
    });
  } else if (ctx.charsetFromMeta.toLowerCase() !== "utf-8") {
    findings.push({
      status: "warn", category: cat, name: "Charset meta",
      message: `${ctx.charsetFromMeta} – UTF-8 recommended`,
      priority: "medium",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Charset meta",
      message: "UTF-8", priority: "medium",
    });
  }

  // Viewport
  const viewport = $('meta[name="viewport"]').attr("content")?.trim();
  if (!viewport) {
    findings.push({
      status: "fail", category: cat, name: "Viewport",
      message: "No <meta name=\"viewport\"> – not mobile-optimized",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
      priority: "medium",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Viewport",
      message: viewport, priority: "medium",
    });
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
  } catch {
    return a === b;
  }
}
