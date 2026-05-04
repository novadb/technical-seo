import type { AuditContext, Check, Finding } from "../types.js";

const VALID_CARD_TYPES = ["summary", "summary_large_image", "app", "player"];

export const twitterCardsCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Twitter Cards" as const;
  const $ = ctx.$;

  const get = (n: string) =>
    $(`meta[name="${n}"]`).attr("content")?.trim()
    ?? $(`meta[property="${n}"]`).attr("content")?.trim()
    ?? "";

  const card = get("twitter:card");
  if (!card) {
    findings.push({
      status: "fail", category: cat, name: "twitter:card",
      message: "Missing",
      fix: 'Add <meta name="twitter:card" content="summary_large_image">',
    });
  } else if (!VALID_CARD_TYPES.includes(card)) {
    findings.push({
      status: "warn", category: cat, name: "twitter:card",
      message: `Unknown type: ${card}`,
      fix: `Use one of the standard types: ${VALID_CARD_TYPES.join(", ")}`,
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "twitter:card",
      message: card,
    });
  }

  for (const tag of ["twitter:title", "twitter:description", "twitter:image"] as const) {
    const v = get(tag);
    if (!v) {
      findings.push({
        status: "warn", category: cat, name: tag,
        message: "Not set (recommended)",
        fix: `Add <meta name="${tag}" content="…">`,
      });
    } else {
      findings.push({
        status: "ok", category: cat, name: tag,
        message: truncate(v, 80),
      });
    }
  }

  return findings;
};

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
