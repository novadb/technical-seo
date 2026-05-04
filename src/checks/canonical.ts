import type { AuditContext, Check, Finding } from "../types.js";
import { isAbsoluteUrl, sameUrl } from "./_url.js";

export const canonicalCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Canonical" as const;
  const $ = ctx.$;

  const canonicalHtml = $('link[rel="canonical"]').attr("href")?.trim() ?? null;
  const canonicalHeader = ctx.linkHeader.find((e) =>
    (e.params["rel"] ?? "").toLowerCase().split(/\s+/).includes("canonical"),
  )?.url ?? null;

  if (!canonicalHtml && !canonicalHeader) {
    findings.push({
      status: "fail", category: cat, name: "Canonical",
      message: "Set neither in <head> nor in the Link header",
      fix: 'Add <link rel="canonical" href="…"> to <head>',
    });
    return findings;
  }

  if (canonicalHtml && canonicalHeader && canonicalHtml !== canonicalHeader) {
    findings.push({
      status: "fail", category: cat, name: "Canonical conflict",
      message: `HTML (${canonicalHtml}) and Link header (${canonicalHeader}) disagree`,
      fix: "Agree on a single consistent canonical URL",
    });
  }

  const canonicalRaw = canonicalHtml ?? canonicalHeader!;

  // Absolute URL check
  if (!isAbsoluteUrl(canonicalRaw)) {
    findings.push({
      status: "fail", category: cat, name: "Canonical absolute URL",
      message: `"${canonicalRaw}" is not an absolute http(s) URL`,
      fix: "Use a fully qualified URL with scheme and host",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Canonical absolute URL",
      message: canonicalRaw,
    });
  }

  // Resolve canonical against final URL for downstream comparisons
  let canonical: URL | null = null;
  try {
    canonical = new URL(canonicalRaw, ctx.finalUrl);
  } catch {
    // Reported above as fail
  }

  // Self-reference
  const matches = sameUrl(canonical?.toString() ?? canonicalRaw, ctx.finalUrl);
  findings.push({
    status: matches ? "ok" : "warn",
    category: cat, name: "Self-reference",
    message: matches
      ? `${canonicalRaw} (self-reference)`
      : `${canonicalRaw} (does not point to final URL ${ctx.finalUrl})`,
    fix: matches ? undefined : "Confirm this is intentional (e.g. pagination, syndication)",
  });

  if (canonical) {
    // Scheme downgrade
    try {
      const finalScheme = new URL(ctx.finalUrl).protocol;
      if (finalScheme === "https:" && canonical.protocol === "http:") {
        findings.push({
          status: "warn", category: cat, name: "Canonical scheme",
          message: "Page is HTTPS but canonical points to HTTP",
          fix: "Use https:// in the canonical URL",
        });
      }
    } catch {
      // ignore
    }

    // Cross-origin
    try {
      const finalOrigin = new URL(ctx.finalUrl).origin;
      if (canonical.origin !== finalOrigin) {
        findings.push({
          status: "info", category: cat, name: "Canonical cross-origin",
          message: `Canonical points to a different origin (${canonical.origin})`,
          fix: "Confirm syndication intent — search engines may credit the other origin",
        });
      }
    } catch {
      // ignore
    }
  }

  // Canonical vs robots noindex
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() ?? "";
  const xRobotsHeader = ctx.headers.get("x-robots-tag") ?? "";
  const combined = [robotsMeta, xRobotsHeader].join(", ").toLowerCase();
  const noindex = /\bnoindex\b|\bnone\b/.test(combined);
  if (noindex && !matches) {
    findings.push({
      status: "fail", category: cat, name: "Canonical vs robots",
      message: "Page is noindex but canonical is non-self — contradictory signals",
      fix: "Either remove noindex or set canonical to self",
    });
  }

  // Canonical vs hreflang
  const hreflangTargets = new Set<string>();
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (href) {
      try {
        hreflangTargets.add(new URL(href, ctx.finalUrl).toString());
      } catch {
        // ignore
      }
    }
  });
  for (const entry of ctx.linkHeader) {
    const rel = (entry.params["rel"] ?? "").toLowerCase();
    if (rel.split(/\s+/).includes("alternate") && entry.params["hreflang"]) {
      try {
        hreflangTargets.add(new URL(entry.url, ctx.finalUrl).toString());
      } catch {
        // ignore
      }
    }
  }
  if (hreflangTargets.size > 0 && canonical) {
    const canonicalNormalized = canonical.toString();
    const inHreflang = [...hreflangTargets].some((t) => sameUrl(t, canonicalNormalized));
    if (!matches && !inHreflang) {
      findings.push({
        status: "warn", category: cat, name: "Canonical vs hreflang",
        message: "Canonical does not match self or any hreflang alternate target",
        fix: "Canonical should point to self or one of the hreflang alternates",
      });
    }
  }

  return findings;
};
