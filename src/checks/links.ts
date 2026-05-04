import type { AuditContext, Check, Finding } from "../types.js";

export const linksCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Links" as const;
  const $ = ctx.$;

  const anchors = $("a").toArray();
  if (anchors.length === 0) {
    findings.push({
      status: "warn", category: cat, name: "Links",
      message: "No <a> elements on the page",
      fix: "Add internal links to support crawl depth",
      priority: "low",
    });
    return findings;
  }

  let internal = 0;
  let external = 0;
  let emptyHref = 0;
  let hashOnly = 0;
  const finalHost = safeHost(ctx.finalUrl);

  for (const el of anchors) {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) { emptyHref++; continue; }
    if (href === "#") { hashOnly++; continue; }
    try {
      const u = new URL(href, ctx.finalUrl);
      if (finalHost && u.host === finalHost) internal++;
      else external++;
    } catch {
      // ignore malformed
    }
  }

  if (internal === 0) {
    findings.push({
      status: "warn", category: cat, name: "Internal links",
      message: "No internal links detected",
      fix: "Add internal links to important sub-pages",
      priority: "low",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Internal links",
      message: `${internal} internal / ${external} external links`,
      priority: "low",
    });
  }

  if (emptyHref + hashOnly > 0) {
    findings.push({
      status: "warn", category: cat, name: "Empty link targets",
      message: `${emptyHref} without href, ${hashOnly} with href="#"`,
      fix: "Set a real target URL or use <button> if no link is intended",
      priority: "low",
    });
  }

  return findings;
};

function safeHost(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}
