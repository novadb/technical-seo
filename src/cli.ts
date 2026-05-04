import type { GroupMode, OutputFormat, Status } from "./types.js";

export interface ParsedArgs {
  url: string | null;
  help: boolean;
  version: boolean;
  noColor: boolean;
  group: GroupMode;
  format: OutputFormat;
  hide: Set<Status>;
  minSeverity: Status | null;
}

const GROUPS: ReadonlySet<GroupMode> = new Set(["category", "severity", "flat"]);
const FORMATS: ReadonlySet<OutputFormat> = new Set(["pretty", "markdown", "compact"]);
const STATUSES: ReadonlySet<Status> = new Set(["ok", "fail", "warn", "info"]);

export class CliError extends Error {}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    url: null,
    help: false,
    version: false,
    noColor: false,
    group: "category",
    format: "pretty",
    hide: new Set(),
    minSeverity: null,
  };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-v" || arg === "--version") out.version = true;
    else if (arg === "--no-color") out.noColor = true;
    else if (arg.startsWith("--group=")) {
      const value = arg.split("=", 2)[1] ?? "";
      if (value === "priority") {
        throw new CliError(`--group=priority was renamed. Use --group=severity instead.`);
      }
      out.group = parseEnum(arg, "group", GROUPS) as GroupMode;
    }
    else if (arg.startsWith("--format=")) out.format = parseEnum(arg, "format", FORMATS) as OutputFormat;
    else if (arg.startsWith("--hide=")) out.hide = parseSet(arg, "hide", STATUSES) as Set<Status>;
    else if (arg.startsWith("--min-severity=")) {
      out.minSeverity = parseEnum(arg, "min-severity", STATUSES) as Status;
    }
    else if (arg.startsWith("--min-priority=")) {
      throw new CliError(
        `--min-priority was removed. Use --min-severity=fail|warn|info|ok instead.`,
      );
    }
    else if (!arg.startsWith("-") && !out.url) out.url = arg;
  }
  return out;
}

function parseEnum(arg: string, name: string, allowed: ReadonlySet<string>): string {
  const value = arg.split("=", 2)[1] ?? "";
  if (!allowed.has(value)) {
    throw new CliError(
      `Invalid value for --${name}: "${value}". Allowed: ${[...allowed].join(", ")}.`,
    );
  }
  return value;
}

function parseSet(arg: string, name: string, allowed: ReadonlySet<string>): Set<string> {
  const raw = arg.split("=", 2)[1] ?? "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!allowed.has(p)) {
      throw new CliError(
        `Invalid value for --${name}: "${p}". Allowed: ${[...allowed].join(", ")}.`,
      );
    }
  }
  return new Set(parts);
}

export function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
