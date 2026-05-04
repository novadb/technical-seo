import type {
  AuditContext,
  Category,
  Finding,
  OutputFormat,
  Priority,
  ReportOptions,
  Status,
} from "./types.js";
import { colors, setColorEnabled } from "./colors.js";

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

const PRIO_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1, info: 0 };
const STATUS_RANK: Record<Status, number> = { fail: 3, warn: 2, info: 1, ok: 0 };

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

const CATEGORY_ORDER: Category[] = [
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

const PRIORITY_ORDER: Priority[] = ["high", "medium", "low", "info"];

export interface SummaryCounts {
  ok: number;
  fail: number;
  warn: number;
  info: number;
  fails: number;
}

interface Group {
  heading: string | null;
  items: Finding[];
}

const DEFAULT_OPTIONS: ReportOptions = {
  group: "category",
  format: "pretty",
  hide: new Set(),
  minPriority: null,
};

export function report(
  findings: Finding[],
  ctx: AuditContext,
  opts: ReportOptions = DEFAULT_OPTIONS,
): SummaryCounts {
  const counts = countAll(findings);
  const visible = applyFilters(findings, opts);
  const groups = groupFindings(visible, opts.group);

  if (opts.format === "markdown") setColorEnabled(false);

  printHeader(ctx, opts.format);

  for (const g of groups) {
    if (g.items.length === 0) continue;
    if (g.heading) {
      console.log("");
      console.log(formatHeading(g.heading, opts.format));
    } else {
      console.log("");
    }
    for (const f of g.items) {
      console.log(renderFinding(f, opts.format));
    }
  }

  console.log("");
  console.log(formatHeading("— Summary —", opts.format));
  console.log(
    `${ICONS.ok} ${counts.ok}  ${ICONS.fail} ${counts.fail}  ${ICONS.warn} ${counts.warn}  ${ICONS.info} ${counts.info}`,
  );
  const hidden = findings.length - visible.length;
  if (hidden > 0) console.log(colors.dim(`(${hidden} finding(s) hidden by filters)`));
  console.log(overallVerdict(counts));

  return counts;
}

function countAll(findings: Finding[]): SummaryCounts {
  const c: SummaryCounts = { ok: 0, fail: 0, warn: 0, info: 0, fails: 0 };
  for (const f of findings) c[f.status]++;
  c.fails = c.fail;
  return c;
}

function applyFilters(findings: Finding[], opts: ReportOptions): Finding[] {
  const min = opts.minPriority ? PRIO_RANK[opts.minPriority] : -1;
  return findings.filter((f) => !opts.hide.has(f.status) && PRIO_RANK[f.priority] >= min);
}

function groupFindings(findings: Finding[], mode: ReportOptions["group"]): Group[] {
  if (mode === "flat") {
    const sorted = [...findings].sort(compareForFlat);
    return [{ heading: null, items: sorted }];
  }
  if (mode === "priority") {
    return PRIORITY_ORDER.map((p) => ({
      heading: `${PRIO_LABEL[p]} priority`,
      items: findings
        .filter((f) => f.priority === p)
        .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]),
    }));
  }
  return CATEGORY_ORDER.map((cat) => ({
    heading: CATEGORY_HEADERS[cat],
    items: findings.filter((f) => f.category === cat),
  }));
}

function compareForFlat(a: Finding, b: Finding): number {
  const s = STATUS_RANK[b.status] - STATUS_RANK[a.status];
  if (s !== 0) return s;
  const p = PRIO_RANK[b.priority] - PRIO_RANK[a.priority];
  if (p !== 0) return p;
  return a.category.localeCompare(b.category);
}

function printHeader(ctx: AuditContext, format: OutputFormat): void {
  const titleEl = ctx.$("title").first().text().trim();
  if (format === "markdown") {
    console.log("# Technical SEO Audit");
    console.log("");
    console.log(`- **URL:** ${ctx.inputUrl}`);
    if (ctx.finalUrl !== ctx.inputUrl) console.log(`- **Final URL:** ${ctx.finalUrl}`);
    console.log(`- **Status:** ${ctx.status} (${ctx.redirectChain.length} redirect(s))`);
    console.log(`- **Language:** ${ctx.htmlLang ?? "(not set)"}`);
    if (titleEl) console.log(`- **Title:** ${truncate(titleEl, 100)}`);
    return;
  }
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

function formatHeading(text: string, format: OutputFormat): string {
  if (format === "markdown") return `## ${text}`;
  return colors.bold(text);
}

function renderFinding(f: Finding, format: OutputFormat): string {
  const icon = ICONS[f.status];
  if (format === "markdown") {
    const fix = f.fix ? ` _Fix: ${f.fix}._` : "";
    return `- ${icon} **${f.name}** — ${f.message}.${fix} \`${PRIO_LABEL[f.priority]}\``;
  }
  if (format === "compact") {
    return `${icon} ${f.category} · ${f.name}: ${f.message}`;
  }
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
