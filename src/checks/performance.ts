import type { AuditContext, Check, Finding } from "../types.js";

export const performanceCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Performance" as const;
  const $ = ctx.$;

  // TTFB
  const ttfb = Math.round(ctx.ttfbMs);
  if (ttfb < 600) {
    findings.push({
      status: "ok", category: cat, name: "TTFB",
      message: `${ttfb} ms (target < 600 ms)`,
    });
  } else if (ttfb < 1500) {
    findings.push({
      status: "warn", category: cat, name: "TTFB",
      message: `${ttfb} ms (Google "good" is < 600 ms)`,
      fix: "Reduce server processing time, enable caching, use a CDN",
    });
  } else {
    findings.push({
      status: "fail", category: cat, name: "TTFB",
      message: `${ttfb} ms — well above 600 ms target`,
      fix: "Investigate slow backend, DB queries, edge caching",
    });
  }

  // Total fetch time
  findings.push({
    status: "info", category: cat, name: "Total fetch time",
    message: `${Math.round(ctx.totalMs)} ms (TTFB + body)`,
  });

  // HTML size (transferred vs raw)
  const contentLength = parseInt(ctx.headers.get("content-length") ?? "", 10);
  const transferred = Number.isFinite(contentLength) ? contentLength : null;
  const raw = ctx.htmlBytes;

  const sizeMsg = transferred !== null
    ? `${formatBytes(transferred)} transferred, ${formatBytes(raw)} raw`
    : `${formatBytes(raw)} raw`;

  if (raw > 500 * 1024) {
    findings.push({
      status: "warn", category: cat, name: "HTML size",
      message: `${sizeMsg} — exceeds 500 KB raw`,
      fix: "Reduce inline scripts/styles, defer non-critical content",
    });
  } else if (transferred !== null && transferred > 100 * 1024) {
    findings.push({
      status: "warn", category: cat, name: "HTML size",
      message: `${sizeMsg} — transferred exceeds 100 KB`,
      fix: "Improve compression or trim payload",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "HTML size",
      message: sizeMsg,
    });
  }

  // Render-blocking stylesheets in <head>
  const blockingCss = $('head link[rel="stylesheet"]').filter((_, el) => {
    const $el = $(el);
    if ($el.attr("disabled") !== undefined) return false;
    const media = ($el.attr("media") ?? "").toLowerCase().trim();
    if (media === "print") return false;
    return true;
  });
  if (blockingCss.length === 0) {
    findings.push({
      status: "ok", category: cat, name: "Render-blocking CSS",
      message: "No render-blocking stylesheets in <head>",
    });
  } else if (blockingCss.length <= 4) {
    findings.push({
      status: "info", category: cat, name: "Render-blocking CSS",
      message: `${blockingCss.length} stylesheet${blockingCss.length === 1 ? "" : "s"}`,
    });
  } else {
    findings.push({
      status: "warn", category: cat, name: "Render-blocking CSS",
      message: `${blockingCss.length} stylesheets in <head>`,
      fix: "Bundle, inline critical CSS, or load non-critical CSS with media=print + onload trick",
    });
  }

  // Render-blocking scripts in <head>
  const blockingScripts = $("head script[src]").filter((_, el) => {
    const $el = $(el);
    if ($el.attr("async") !== undefined) return false;
    if ($el.attr("defer") !== undefined) return false;
    const type = ($el.attr("type") ?? "").toLowerCase();
    if (type === "module") return false;
    return true;
  });
  if (blockingScripts.length === 0) {
    findings.push({
      status: "ok", category: cat, name: "Render-blocking JS",
      message: "No render-blocking scripts in <head>",
    });
  } else {
    findings.push({
      status: "warn", category: cat, name: "Render-blocking JS",
      message: `${blockingScripts.length} script${blockingScripts.length === 1 ? "" : "s"} without async/defer/type=module`,
      fix: "Add defer or async, or move to end of <body>",
    });
  }

  // Preconnect / preload hints
  const hints = $('head link').filter((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    return /\b(preconnect|dns-prefetch|preload|modulepreload)\b/.test(rel);
  });
  if (hints.length > 0) {
    findings.push({
      status: "info", category: cat, name: "Resource hints",
      message: `${hints.length} preconnect/preload hint${hints.length === 1 ? "" : "s"}`,
    });
  }

  return findings;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
