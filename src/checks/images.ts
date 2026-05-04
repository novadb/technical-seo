import type { AuditContext, Check, Finding } from "../types.js";

const FILENAME_LIKE = /^[a-z0-9_\-]+\.(jpe?g|png|webp|gif|svg|avif)$/i;

export const imagesCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Images" as const;
  const $ = ctx.$;

  const imgs = $("img").toArray();
  if (imgs.length === 0) {
    findings.push({
      status: "info", category: cat, name: "Images",
      message: "No <img> elements on the page",
      priority: "info",
    });
    return findings;
  }

  const missing: string[] = [];
  const suspicious: string[] = [];
  let emptyAltDecorative = 0;
  let goodAlt = 0;

  for (const el of imgs) {
    const $el = $(el);
    const src = ($el.attr("src") ?? $el.attr("data-src") ?? "").trim();
    if (!$el.is("[alt]")) {
      missing.push(src || "(no src)");
      continue;
    }
    const alt = ($el.attr("alt") ?? "").trim();
    if (alt === "") {
      emptyAltDecorative++;
      continue;
    }
    if (alt.length <= 2 || FILENAME_LIKE.test(alt)) {
      suspicious.push(`${alt} (src: ${truncate(src, 60)})`);
      continue;
    }
    goodAlt++;
  }

  // Missing alt entirely
  if (missing.length === 0) {
    findings.push({
      status: "ok", category: cat, name: "Alt attributes",
      message: `All ${imgs.length} <img> have an alt attribute`,
      priority: "high",
    });
  } else {
    const sample = missing.slice(0, 5).join(", ");
    findings.push({
      status: "fail", category: cat, name: "Alt attributes",
      message: `${missing.length} of ${imgs.length} images without alt attribute. Examples: ${sample}`,
      fix: 'Give every <img> an alt attribute (alt="" for purely decorative images)',
      priority: "high",
    });
  }

  // Quality
  if (suspicious.length > 0) {
    const sample = suspicious.slice(0, 5).join("; ");
    findings.push({
      status: "warn", category: cat, name: "Alt quality",
      message: `${suspicious.length} suspicious alt texts (too short or filename). Examples: ${sample}`,
      fix: "Phrase alt texts descriptively – don't repeat the filename",
      priority: "medium",
    });
  } else if (goodAlt > 0) {
    findings.push({
      status: "ok", category: cat, name: "Alt quality",
      message: `${goodAlt} alt texts look plausible`,
      priority: "medium",
    });
  }

  if (emptyAltDecorative > 0) {
    findings.push({
      status: "info", category: cat, name: "Decorative images",
      message: `${emptyAltDecorative} <img> with alt="" (marked as decorative)`,
      priority: "info",
    });
  }

  return findings;
};

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
