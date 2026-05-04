import type { GroupMode, OutputFormat, ShowMode } from "./types.js";

export interface ParsedArgs {
  url: string | null;
  help: boolean;
  version: boolean;
  noColor: boolean;
  group: GroupMode;
  format: OutputFormat;
  show: ShowMode;
}

const GROUPS: ReadonlySet<GroupMode> = new Set(["category", "status", "flat"]);
const FORMATS: ReadonlySet<OutputFormat> = new Set(["pretty", "markdown", "compact"]);
const SHOW_MODES: ReadonlySet<ShowMode> = new Set(["all", "issues", "fails"]);

export class CliError extends Error {}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    url: null,
    help: false,
    version: false,
    noColor: false,
    group: "status",
    format: "pretty",
    show: "all",
  };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-v" || arg === "--version") out.version = true;
    else if (arg === "--no-color") out.noColor = true;
    else if (arg.startsWith("--group=")) out.group = parseEnum(arg, "group", GROUPS) as GroupMode;
    else if (arg.startsWith("--format=")) out.format = parseEnum(arg, "format", FORMATS) as OutputFormat;
    else if (arg.startsWith("--show=")) out.show = parseEnum(arg, "show", SHOW_MODES) as ShowMode;
    else if (arg.startsWith("-")) throw new CliError(`Unknown option: ${arg.split("=", 2)[0]}`);
    else if (!out.url) out.url = arg;
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

export function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
