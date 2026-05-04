import type { AuditContext, Check, Finding } from "../types.js";

export const headingsCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Heading Structure" as const;
  const $ = ctx.$;

  const all = $("h1, h2, h3, h4, h5, h6").toArray();
  const h1s = $("h1").toArray();

  // Single H1
  if (h1s.length === 0) {
    findings.push({
      status: "fail", category: cat, name: "H1 present",
      message: "No <h1> on the page",
      fix: "Add exactly one meaningful <h1>",
      priority: "high",
    });
  } else if (h1s.length === 1) {
    findings.push({
      status: "ok", category: cat, name: "H1 present",
      message: "Exactly one <h1>",
      priority: "high",
    });
  } else {
    findings.push({
      status: "fail", category: cat, name: "H1 present",
      message: `${h1s.length} <h1> elements found`,
      fix: "Reduce to a single <h1>, demote others to <h2>/<h3>",
      priority: "high",
    });
  }

  // Non-empty H1
  if (h1s.length > 0) {
    const empties = h1s.filter((el) => $(el).text().trim().length === 0);
    if (empties.length > 0) {
      findings.push({
        status: "fail", category: cat, name: "H1 not empty",
        message: `${empties.length} <h1> without text content`,
        fix: "Fill the H1 with meaningful text",
        priority: "high",
      });
    } else {
      const text = $(h1s[0]).text().trim();
      findings.push({
        status: "ok", category: cat, name: "H1 not empty",
        message: `"${truncate(text, 80)}"`,
        priority: "high",
      });
    }
  }

  // Hierarchy
  let prevLevel = 0;
  let firstSkip: { from: number; to: number } | null = null;
  for (const el of all) {
    const level = parseInt((el as { tagName?: string }).tagName?.slice(1) ?? "0", 10);
    if (prevLevel > 0 && level > prevLevel + 1 && !firstSkip) {
      firstSkip = { from: prevLevel, to: level };
    }
    prevLevel = level;
  }
  if (firstSkip) {
    findings.push({
      status: "warn", category: cat, name: "Heading hierarchy",
      message: `Jump from h${firstSkip.from} to h${firstSkip.to}`,
      fix: "Use heading levels contiguously (don't skip a level)",
      priority: "medium",
    });
  } else if (all.length > 0) {
    findings.push({
      status: "ok", category: cat, name: "Heading hierarchy",
      message: "No skipped levels",
      priority: "medium",
    });
  }

  // Total count
  if (all.length > 15) {
    findings.push({
      status: "warn", category: cat, name: "Heading count",
      message: `${all.length} headings (threshold: ~15)`,
      fix: "Check for over-optimization, tighten the structure if needed",
      priority: "low",
    });
  } else {
    findings.push({
      status: "info", category: cat, name: "Heading count",
      message: `${all.length} headings total`,
      priority: "info",
    });
  }

  return findings;
};

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
