import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AuditContext, FetchResult, ParsedLinkHeaderEntry } from "./types.js";

export function buildAuditContext(fetched: FetchResult): AuditContext {
  const $ = load(fetched.rawHtml);

  const contentTypeRaw = fetched.headers.get("content-type");
  const charsetFromHeader = parseCharsetFromContentType(contentTypeRaw);

  const metaCharsetEl = $("meta[charset]").first();
  const charsetFromMeta = metaCharsetEl.attr("charset")?.trim() || null;

  const metaRefresh = parseMetaRefresh($);

  const linkHeader = parseLinkHeader(fetched.headers.get("link"));

  const htmlLang = $("html").attr("lang")?.trim() || null;

  return {
    ...fetched,
    $,
    metaRefresh,
    contentTypeRaw,
    charsetFromHeader,
    charsetFromMeta,
    linkHeader,
    htmlLang,
  };
}

function parseCharsetFromContentType(value: string | null): string | null {
  if (!value) return null;
  const match = /charset\s*=\s*"?([^";\s]+)"?/i.exec(value);
  return match ? match[1] : null;
}

function parseMetaRefresh($: CheerioAPI): AuditContext["metaRefresh"] {
  const el = $('meta[http-equiv]').filter((_, e) => {
    const v = $(e).attr("http-equiv");
    return !!v && v.toLowerCase() === "refresh";
  }).first();
  if (el.length === 0) return null;
  const content = el.attr("content")?.trim() ?? "";
  if (!content) return null;
  const m = /^\s*(\d+)\s*(?:;\s*url\s*=\s*['"]?([^'"]+?)['"]?)?\s*$/i.exec(content);
  if (!m) return { seconds: 0, url: "" };
  return {
    seconds: parseInt(m[1], 10),
    url: m[2] ?? "",
  };
}

function parseLinkHeader(value: string | null): ParsedLinkHeaderEntry[] {
  if (!value) return [];
  const entries: ParsedLinkHeaderEntry[] = [];
  const parts = splitLinkHeader(value);
  for (const part of parts) {
    const m = /^\s*<([^>]+)>\s*(.*)$/.exec(part);
    if (!m) continue;
    const url = m[1].trim();
    const paramStr = m[2].trim();
    const params: Record<string, string> = {};
    if (paramStr) {
      const segs = paramStr.split(";");
      for (const seg of segs) {
        const trimmed = seg.trim();
        if (!trimmed) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) {
          params[trimmed.toLowerCase()] = "";
          continue;
        }
        const k = trimmed.slice(0, eq).trim().toLowerCase();
        let v = trimmed.slice(eq + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        params[k] = v;
      }
    }
    entries.push({ url, params });
  }
  return entries;
}

function splitLinkHeader(value: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"' && value[i - 1] !== "\\") inQuote = !inQuote;
    else if (!inQuote && c === "<") depth++;
    else if (!inQuote && c === ">") depth--;
    if (c === "," && !inQuote && depth === 0) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}
