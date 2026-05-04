import { buildAuditContext } from "../../src/parser.js";
import type { AuditContext, FetchResult, RedirectHop } from "../../src/types.js";

export interface MakeContextOpts {
  html: string;
  inputUrl?: string;
  finalUrl?: string;
  status?: number;
  headers?: Record<string, string>;
  redirectChain?: RedirectHop[];
  schemeDowngrade?: boolean;
}

export function makeContext(opts: MakeContextOpts): AuditContext {
  const inputUrl = opts.inputUrl ?? "https://example.com/";
  const finalUrl = opts.finalUrl ?? inputUrl;
  const headers = new Headers(
    opts.headers ?? { "content-type": "text/html; charset=utf-8" },
  );
  const fetched: FetchResult = {
    inputUrl,
    finalUrl,
    status: opts.status ?? 200,
    headers,
    redirectChain: opts.redirectChain ?? [],
    rawHtml: opts.html,
    schemeDowngrade: opts.schemeDowngrade ?? false,
  };
  return buildAuditContext(fetched);
}
