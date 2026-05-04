import type { AuditContext, Check, Finding } from "../types.js";

export const httpResponseCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "HTTP Response" as const;

  // Status code
  if (ctx.status === 200) {
    findings.push({
      status: "ok", category: cat, name: "HTTP status",
      message: "200 OK",
    });
  } else if (ctx.status >= 300 && ctx.status < 400) {
    findings.push({
      status: "fail", category: cat, name: "HTTP status",
      message: `Final status ${ctx.status} – page still returns a redirect`,
      fix: "Use the redirect target directly or fix the endpoint",
    });
  } else if (ctx.status >= 400 && ctx.status < 500) {
    findings.push({
      status: "fail", category: cat, name: "HTTP status",
      message: `Client error ${ctx.status}`,
      fix: "Check the URL or adjust the server configuration",
    });
  } else if (ctx.status >= 500) {
    findings.push({
      status: "fail", category: cat, name: "HTTP status",
      message: `Server error ${ctx.status}`,
      fix: "Check server logs and fix the root cause",
    });
  } else {
    findings.push({
      status: "warn", category: cat, name: "HTTP status",
      message: `Unusual status ${ctx.status}`,
    });
  }

  // Redirect chain
  if (ctx.redirectChain.length === 0) {
    findings.push({
      status: "ok", category: cat, name: "Redirect chain",
      message: "No redirects",
    });
  } else {
    const has302 = ctx.redirectChain.some((h) => h.status === 302 || h.status === 307);
    const longChain = ctx.redirectChain.length > 1;
    const issue = has302 || longChain;
    const chainStr = ctx.redirectChain
      .map((h) => `${h.status}→${h.location}`)
      .join(" ▶ ");
    findings.push({
      status: issue ? "warn" : "ok",
      category: cat,
      name: "Redirect chain",
      message: `${ctx.redirectChain.length} hop(s): ${chainStr}`,
      fix: has302
        ? "302/307 are temporary – switch to 301 if permanent"
        : longChain
          ? "Collapse multiple hops into a single direct 301"
          : undefined,
    });
  }

  // HTTPS
  const inputProto = safeProto(ctx.inputUrl);
  const finalProto = safeProto(ctx.finalUrl);
  if (inputProto === "https:" && finalProto === "https:") {
    findings.push({
      status: "ok", category: cat, name: "HTTPS",
      message: "HTTPS end-to-end",
    });
  } else if (inputProto === "http:" && finalProto === "https:") {
    findings.push({
      status: "warn", category: cat, name: "HTTPS",
      message: "Input URL was http://, redirected to https://",
      fix: "Use the https:// URL directly when linking externally",
    });
  } else if (finalProto !== "https:") {
    findings.push({
      status: "fail", category: cat, name: "HTTPS",
      message: `Final URL uses ${finalProto || "unknown protocol"}`,
      fix: "Set up a TLS certificate and 301-redirect http to https",
    });
  }
  if (ctx.schemeDowngrade) {
    findings.push({
      status: "fail", category: cat, name: "Scheme downgrade",
      message: "Detected redirect from https → http",
      fix: "Check server configuration – downgrading is a security issue",
    });
  }

  // Content-Type
  const ct = ctx.contentTypeRaw;
  if (!ct) {
    findings.push({
      status: "warn", category: cat, name: "Content-Type",
      message: "Header missing",
      fix: "Server must send Content-Type: text/html; charset=utf-8",
    });
  } else if (!/^text\/html/i.test(ct)) {
    findings.push({
      status: "warn", category: cat, name: "Content-Type",
      message: `Unexpected type: ${ct}`,
      fix: "Set text/html for HTML pages",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Content-Type",
      message: ct,
    });
  }

  // Charset in header
  if (!ctx.charsetFromHeader) {
    findings.push({
      status: "warn", category: cat, name: "Charset (header)",
      message: "No charset declared in Content-Type header",
      fix: "Include charset=utf-8 in the Content-Type header",
    });
  } else if (ctx.charsetFromHeader.toLowerCase() !== "utf-8") {
    findings.push({
      status: "warn", category: cat, name: "Charset (header)",
      message: `Charset is ${ctx.charsetFromHeader} – UTF-8 recommended`,
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Charset (header)",
      message: "utf-8",
    });
  }

  // Content-Encoding
  const enc = ctx.headers.get("content-encoding");
  if (!enc) {
    findings.push({
      status: "warn", category: cat, name: "Content-Encoding",
      message: "No compression — performance drawback",
      fix: "Enable gzip or brotli on the web server",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Content-Encoding",
      message: enc,
    });
  }

  // X-Robots-Tag
  const xrt = ctx.headers.get("x-robots-tag");
  if (xrt) {
    const lower = xrt.toLowerCase();
    const restrictive = /noindex|nofollow|none/.test(lower);
    findings.push({
      status: restrictive ? "fail" : "info",
      category: cat,
      name: "X-Robots-Tag (header)",
      message: xrt,
      fix: restrictive
        ? "Remove the header if the page should be indexed"
        : undefined,
    });
  }

  // Link header
  if (ctx.linkHeader.length > 0) {
    const rels = ctx.linkHeader
      .map((e) => e.params["rel"])
      .filter(Boolean);
    findings.push({
      status: "info",
      category: cat,
      name: "Link header",
      message: `${ctx.linkHeader.length} entries (${rels.join(", ") || "without rel"})`,
    });
  }

  return findings;
};

function safeProto(url: string): string | null {
  try { return new URL(url).protocol; } catch { return null; }
}
