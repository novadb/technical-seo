export interface ParsedArgs {
  url: string | null;
  help: boolean;
  version: boolean;
  noColor: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { url: null, help: false, version: false, noColor: false };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-v" || arg === "--version") out.version = true;
    else if (arg === "--no-color") out.noColor = true;
    else if (!arg.startsWith("-") && !out.url) out.url = arg;
  }
  return out;
}

export function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
