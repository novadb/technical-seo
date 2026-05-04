import type { AuditContext, Check, Finding } from "../types.js";

const REQUIRED_FIELDS: Record<string, string[]> = {
  Article: ["headline", "author", "datePublished"],
  NewsArticle: ["headline", "author", "datePublished"],
  BlogPosting: ["headline", "author", "datePublished"],
  Product: ["name", "image"],
  Organization: ["name"],
  WebSite: ["name", "url"],
  BreadcrumbList: ["itemListElement"],
  FAQPage: ["mainEntity"],
  Recipe: ["name", "recipeIngredient", "recipeInstructions"],
  Event: ["name", "startDate", "location"],
};

export const structuredDataCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Structured Data" as const;
  const $ = ctx.$;

  const blocks = $('script[type="application/ld+json"]').toArray();
  if (blocks.length === 0) {
    findings.push({
      status: "warn", category: cat, name: "JSON-LD",
      message: "No JSON-LD blocks found",
      fix: "Add structured data matching the content type (Schema.org)",
      priority: "medium",
    });
    return findings;
  }

  findings.push({
    status: "ok", category: cat, name: "JSON-LD present",
    message: `${blocks.length} <script type="application/ld+json"> block(s)`,
    priority: "medium",
  });

  const types: string[] = [];
  let parseErrors = 0;

  for (const block of blocks) {
    const raw = $(block).text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      parseErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      findings.push({
        status: "fail", category: cat, name: "JSON-LD Parsing",
        message: `Invalid JSON: ${msg}`,
        fix: "Fix JSON syntax (e.g. validate with jsonlint)",
        priority: "high",
      });
      continue;
    }
    collectTypes(data, types);

    // Required-field check on each top-level @type
    walkTopLevel(data, (obj) => {
      const t = obj["@type"];
      if (typeof t !== "string") return;
      const required = REQUIRED_FIELDS[t];
      if (!required) return;
      const missing = required.filter((f) => !(f in obj));
      if (missing.length > 0) {
        findings.push({
          status: "warn", category: cat, name: `${t} – required fields`,
          message: `Missing: ${missing.join(", ")}`,
          fix: `Add fields ${missing.join(", ")} to the JSON-LD object`,
          priority: "medium",
        });
      }
    });
  }

  if (parseErrors === 0) {
    findings.push({
      status: "ok", category: cat, name: "JSON-LD Parsing",
      message: "All blocks parse cleanly",
      priority: "high",
    });
  }

  if (types.length > 0) {
    const unique = [...new Set(types)];
    findings.push({
      status: "info", category: cat, name: "@type detection",
      message: `Detected types: ${unique.join(", ")}`,
      priority: "info",
    });
  }

  return findings;
};

function collectTypes(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") out.push(x);
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) collectTypes(item, out);
    }
  }
}

function walkTopLevel(
  node: unknown,
  fn: (obj: Record<string, unknown>) => void,
): void {
  if (Array.isArray(node)) {
    for (const item of node) walkTopLevel(item, fn);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    fn(obj);
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) walkTopLevel(item, fn);
    }
  }
}
