import type { AuditContext, Category, Finding, Priority, Status } from "./types.js";
import { colors } from "./colors.js";

const ICONS: Record<Status, string> = {
  ok: "✅",
  fail: "❌",
  warn: "⚠️",
  info: "ℹ️",
};

const PRIO_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const CATEGORY_HEADERS: Record<Category, string> = {
  "HTTP Response": "🌐 HTTP Response",
  "Document Foundation": "📄 Document Foundation",
  "Meta & Head": "🏷️  Meta & Head",
  "Heading Structure": "📐 Heading Structure",
  Images: "🖼️  Images",
  "Open Graph": "📣 Open Graph",
  "Twitter Cards": "🐦 Twitter Cards",
  Hreflang: "🌍 Hreflang / Internationalization",
  "Structured Data": "🧩 Structured Data",
  Links: "🔗 Links",
};

const ORDER: Category[] = [
  "HTTP Response",
  "Document Foundation",
  "Meta & Head",
  "Heading Structure",
  "Images",
  "Open Graph",
  "Twitter Cards",
  "Hreflang",
  "Structured Data",
  "Links",
];

export interface SummaryCounts {
  ok: number;
  fail: number;
  warn: number;
  info: number;
  fails: number;
}

export function report(findings: Finding[], ctx: AuditContext): SummaryCounts {
  printHeader(ctx);

  const counts: SummaryCounts = { ok: 0, fail: 0, warn: 0, info: 0, fails: 0 };

  for (const cat of ORDER) {
    const items = findings.filter((f) => f.category === cat);
    if (items.length === 0) continue;
    console.log("");
    console.log(colors.bold(CATEGORY_HEADERS[cat]));
    for (const f of items) {
      console.log(formatLine(f));
      counts[f.status]++;
    }
  }
  counts.fails = counts.fail;

  console.log("");
  console.log(colors.bold("— Summary —"));
  console.log(
    `${ICONS.ok} ${counts.ok}  ${ICONS.fail} ${counts.fail}  ${ICONS.warn} ${counts.warn}  ${ICONS.info} ${counts.info}`,
  );
  console.log(overallVerdict(counts));

  return counts;
}

function printHeader(ctx: AuditContext): void {
  const titleEl = ctx.$("title").first().text().trim();
  console.log(colors.bold("Technical SEO Audit"));
  console.log(`${colors.gray("URL:")}        ${ctx.inputUrl}`);
  if (ctx.finalUrl !== ctx.inputUrl) {
    console.log(`${colors.gray("Final URL:")}  ${ctx.finalUrl}`);
  }
  console.log(
    `${colors.gray("Status:")}     ${ctx.status}   ${colors.gray("Redirects:")} ${ctx.redirectChain.length}`,
  );
  console.log(`${colors.gray("Language:")}   ${ctx.htmlLang ?? "(not set)"}`);
  if (titleEl) console.log(`${colors.gray("Title:")}      ${truncate(titleEl, 100)}`);
}

function formatLine(f: Finding): string {
  const icon = ICONS[f.status];
  const name = colors.bold(f.name);
  const fix = f.fix ? ` Fix: ${f.fix}.` : "";
  const prio = colors.dim(`Priority: ${PRIO_LABEL[f.priority]}`);
  const colored = colorMessage(f.status, f.message);
  return `  ${icon} ${name} — ${colored}.${fix} ${prio}`;
}

function colorMessage(status: Status, msg: string): string {
  switch (status) {
    case "ok": return colors.green(msg);
    case "fail": return colors.red(msg);
    case "warn": return colors.yellow(msg);
    case "info": return colors.cyan(msg);
  }
}

function overallVerdict(c: SummaryCounts): string {
  if (c.fail === 0 && c.warn === 0) return colors.green("Clean page — no critical SEO issues.");
  if (c.fail === 0) return colors.yellow(`Mostly OK, but review ${c.warn} warning(s).`);
  return colors.red(`${c.fail} critical issue(s) found — please fix.`);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
