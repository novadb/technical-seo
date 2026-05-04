import type { CheerioAPI } from "cheerio";

export type Status = "ok" | "fail" | "warn" | "info";

export type Category =
  | "HTTP Response"
  | "Document Foundation"
  | "Meta & Head"
  | "Heading Structure"
  | "Images"
  | "Open Graph"
  | "Twitter Cards"
  | "Hreflang"
  | "Structured Data"
  | "Links";

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface FetchResult {
  inputUrl: string;
  finalUrl: string;
  redirectChain: RedirectHop[];
  status: number;
  headers: Headers;
  rawHtml: string;
  schemeDowngrade: boolean;
}

export interface ParsedLinkHeaderEntry {
  url: string;
  params: Record<string, string>;
}

export interface AuditContext extends FetchResult {
  $: CheerioAPI;
  metaRefresh: { seconds: number; url: string } | null;
  contentTypeRaw: string | null;
  charsetFromHeader: string | null;
  charsetFromMeta: string | null;
  linkHeader: ParsedLinkHeaderEntry[];
  htmlLang: string | null;
}

export interface Finding {
  status: Status;
  category: Category;
  name: string;
  message: string;
  fix?: string;
}

export type Check = (ctx: AuditContext) => Finding[] | Promise<Finding[]>;

export type GroupMode = "category" | "status" | "flat";
export type OutputFormat = "pretty" | "markdown" | "compact";
export type ShowMode = "all" | "issues" | "fails";

export interface ReportOptions {
  group: GroupMode;
  format: OutputFormat;
  show: ShowMode;
}
