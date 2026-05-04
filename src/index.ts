import { fetchWithRedirectChain } from "./fetcher.js";
import { buildAuditContext } from "./parser.js";
import { CHECKS } from "./checks/index.js";
import { report } from "./reporter.js";
import { setColorEnabled } from "./colors.js";
import { parseArgs, normalizeUrl, CliError } from "./cli.js";
import type { Finding, ReportOptions } from "./types.js";

const VERSION = "0.1.0";

function printUsage(): void {
  console.log(`technical-seo v${VERSION}

Usage:
  npx github:novadb/technical-seo <url>
  technical-seo <url> [--no-color]

Examples:
  npx github:novadb/technical-seo https://example.com
  technical-seo https://example.com --no-color

Options:
  -h, --help                Show this help
  -v, --version             Print version
      --no-color            Disable colored output
      --group=MODE          Group findings: category (default), priority, flat
      --format=FORMAT       Output format: pretty (default), markdown, compact
      --hide=STATUSES       Comma-separated statuses to suppress (ok,warn,fail,info)
      --min-priority=LEVEL  Hide findings below: high, medium, low, info

Examples:
  technical-seo https://example.com --group=priority --hide=ok
  technical-seo https://example.com --format=markdown --no-color > report.md
`);
}

async function main(): Promise<void> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CliError) {
      console.error(`❌ ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
  if (args.help) { printUsage(); process.exit(0); }
  if (args.version) { console.log(VERSION); process.exit(0); }
  if (args.noColor) setColorEnabled(false);

  if (!args.url) {
    printUsage();
    process.exit(2);
  }

  const url = normalizeUrl(args.url);

  let fetched;
  try {
    fetched = await fetchWithRedirectChain(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Fetch failed: ${msg}`);
    process.exit(2);
  }

  const ctx = buildAuditContext(fetched);

  const findings: Finding[] = [];
  for (const check of CHECKS) {
    try {
      const result = await check(ctx);
      findings.push(...result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      findings.push({
        status: "warn",
        category: "HTTP Response",
        name: "Check error",
        message: `A check threw an exception: ${msg}`,
        priority: "low",
      });
    }
  }

  const opts: ReportOptions = {
    group: args.group,
    format: args.format,
    hide: args.hide,
    minPriority: args.minPriority,
  };
  const summary = report(findings, ctx, opts);
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
