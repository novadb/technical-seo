import { load } from "cheerio";
import type { AuditContext, Check, Finding } from "../types.js";

const USER_AGENT = "technical-seo/0.1 (+npx github:novadb/technical-seo)";
const FETCH_TIMEOUT_MS = 8000;
const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
const SITEMAP_MAX_URLS = 50000;

interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}
interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}
interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  raw: string;
}

export const robotsCheck: Check = async (ctx: AuditContext): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const cat = "Robots & Sitemaps" as const;
  const finalUrl = new URL(ctx.finalUrl);
  const robotsUrl = `${finalUrl.origin}/robots.txt`;

  const robotsResp = await fetchText(robotsUrl);
  if (!robotsResp.ok) {
    if (robotsResp.status === 404) {
      findings.push({
        status: "warn", category: cat, name: "robots.txt",
        message: `Not found at ${robotsUrl}`,
        fix: "Add robots.txt at the site root",
      });
    } else {
      findings.push({
        status: "fail", category: cat, name: "robots.txt",
        message: `Fetch failed (${robotsResp.status ?? robotsResp.error ?? "unknown"})`,
        fix: "Ensure /robots.txt is reachable and returns 200",
      });
    }
    // continue with sitemap fallback
    await runSitemapChecks(ctx, findings, []);
    return findings;
  }

  const parsed = parseRobots(robotsResp.body!);
  findings.push({
    status: "ok", category: cat, name: "robots.txt reachable",
    message: `${robotsUrl} (${robotsResp.body!.length} bytes, ${parsed.groups.length} group${parsed.groups.length === 1 ? "" : "s"})`,
  });

  // URL allowed for *
  const path = finalUrl.pathname + finalUrl.search;
  const verdict = isAllowed(path, parsed, "*");
  if (verdict.allowed) {
    findings.push({
      status: "ok", category: cat, name: "URL allowed for *",
      message: verdict.matchedRule
        ? `Allowed (matched ${verdict.matchedRule.type}: ${verdict.matchedRule.path || "(empty)"})`
        : "Allowed (no matching rule)",
    });
  } else {
    findings.push({
      status: "fail", category: cat, name: "URL allowed for *",
      message: `Disallowed by ${verdict.matchedRule!.type}: ${verdict.matchedRule!.path} — page should not be indexed`,
      fix: "Either remove the Disallow rule or accept that this URL will not be crawled",
    });
  }

  // Sitemap directives
  if (parsed.sitemaps.length === 0) {
    findings.push({
      status: "warn", category: cat, name: "Sitemap directive",
      message: "No Sitemap: directive in robots.txt",
      fix: "Add Sitemap: <absolute URL> to robots.txt",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Sitemap directive",
      message: `${parsed.sitemaps.length} declared: ${parsed.sitemaps.slice(0, 3).join(", ")}${parsed.sitemaps.length > 3 ? ", …" : ""}`,
    });
  }

  await runSitemapChecks(ctx, findings, parsed.sitemaps);
  return findings;
};

async function runSitemapChecks(
  ctx: AuditContext,
  findings: Finding[],
  declared: string[],
): Promise<void> {
  const cat = "Robots & Sitemaps" as const;
  const finalUrl = new URL(ctx.finalUrl);
  const candidates = declared.length > 0 ? declared : [`${finalUrl.origin}/sitemap.xml`];
  const primary = candidates[0]!;

  const resp = await fetchText(primary);
  if (!resp.ok) {
    findings.push({
      status: declared.length > 0 ? "fail" : "warn",
      category: cat, name: "Sitemap reachable",
      message: `${primary} returned ${resp.status ?? resp.error ?? "error"}`,
      fix: "Make sure the sitemap returns 200 OK",
    });
    return;
  }
  findings.push({
    status: "ok", category: cat, name: "Sitemap reachable",
    message: `${primary} (${resp.body!.length} bytes)`,
  });

  if (resp.body!.length > SITEMAP_MAX_BYTES) {
    findings.push({
      status: "warn", category: cat, name: "Sitemap size",
      message: `${(resp.body!.length / 1024 / 1024).toFixed(1)} MB exceeds 50 MB limit`,
      fix: "Split into multiple sitemaps and reference via sitemapindex",
    });
  }

  // Parse XML
  let $xml;
  try {
    $xml = load(resp.body!, { xmlMode: true });
  } catch {
    findings.push({
      status: "fail", category: cat, name: "Sitemap XML",
      message: "Could not parse XML",
      fix: "Validate sitemap XML against the sitemaps.org schema",
    });
    return;
  }

  const isUrlset = $xml("urlset").length > 0;
  const isIndex = $xml("sitemapindex").length > 0;
  if (!isUrlset && !isIndex) {
    findings.push({
      status: "fail", category: cat, name: "Sitemap XML",
      message: "Root element is neither <urlset> nor <sitemapindex>",
      fix: "Use the sitemaps.org schema",
    });
    return;
  }
  findings.push({
    status: "ok", category: cat, name: "Sitemap XML",
    message: isUrlset ? "<urlset>" : "<sitemapindex>",
  });

  if (isUrlset) {
    const urls = $xml("urlset > url > loc").map((_, el) => $xml(el).text().trim()).get();
    if (urls.length > SITEMAP_MAX_URLS) {
      findings.push({
        status: "warn", category: cat, name: "Sitemap URL count",
        message: `${urls.length} URLs exceeds 50,000 limit`,
        fix: "Split into multiple sitemaps and reference via sitemapindex",
      });
    } else {
      findings.push({
        status: "info", category: cat, name: "Sitemap URL count",
        message: `${urls.length} URLs`,
      });
    }

    const target = ctx.finalUrl;
    const found = urls.some((u) => sameSitemapUrl(u, target));
    findings.push({
      status: found ? "ok" : "warn",
      category: cat, name: "URL in sitemap",
      message: found
        ? `${target} is listed in ${primary}`
        : `${target} not found in ${primary}`,
      fix: found ? undefined : "Add the page to the sitemap or check trailing slash / scheme",
    });
  } else {
    findings.push({
      status: "info", category: cat, name: "URL in sitemap",
      message: "Primary sitemap is a sitemapindex; per-URL lookup not performed (no recursion in v1)",
    });
  }
}

function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let currentAgents: string[] = [];
  let currentRules: RobotsRule[] = [];
  let inAgentBlock = false;

  const flush = () => {
    if (currentAgents.length > 0) {
      groups.push({ agents: [...currentAgents], rules: [...currentRules] });
    }
    currentAgents = [];
    currentRules = [];
    inAgentBlock = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (inAgentBlock && currentRules.length > 0) {
        flush();
      }
      currentAgents.push(value.toLowerCase());
      inAgentBlock = true;
    } else if (key === "allow" || key === "disallow") {
      if (currentAgents.length > 0) {
        currentRules.push({ type: key, path: value });
      }
    } else if (key === "sitemap") {
      if (value) sitemaps.push(value);
    }
  }
  flush();
  return { groups, sitemaps, raw: text };
}

interface AllowVerdict {
  allowed: boolean;
  matchedRule: RobotsRule | null;
}

function isAllowed(path: string, parsed: ParsedRobots, agent: string): AllowVerdict {
  // Pick group whose agent list contains exact agent, else "*"
  const lowered = agent.toLowerCase();
  const exact = parsed.groups.find((g) => g.agents.includes(lowered));
  const wildcard = parsed.groups.find((g) => g.agents.includes("*"));
  const group = exact ?? wildcard;
  if (!group) return { allowed: true, matchedRule: null };

  // Google rule: longest match wins; Allow beats Disallow on tie.
  let best: RobotsRule | null = null;
  let bestLen = -1;
  for (const rule of group.rules) {
    if (matchesRobotsPath(path, rule.path)) {
      const len = rule.path.length;
      if (len > bestLen || (len === bestLen && rule.type === "allow" && best?.type === "disallow")) {
        best = rule;
        bestLen = len;
      }
    }
  }
  if (!best) return { allowed: true, matchedRule: null };
  return { allowed: best.type === "allow", matchedRule: best };
}

function matchesRobotsPath(path: string, pattern: string): boolean {
  if (pattern === "") return false; // empty Disallow means allow all; empty Allow no-op
  // Convert robots.txt pattern (* and $) to RegExp
  const endAnchor = pattern.endsWith("$");
  const body = endAnchor ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp("^" + escaped + (endAnchor ? "$" : ""));
  return re.test(path);
}

function sameSitemapUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
  } catch {
    return a === b;
  }
}

interface FetchTextResult {
  ok: boolean;
  status: number | null;
  body: string | null;
  error?: string;
}

async function fetchText(url: string): Promise<FetchTextResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      await response.arrayBuffer().catch(() => undefined);
      return { ok: false, status: response.status, body: null };
    }
    const body = await response.text();
    return { ok: true, status: response.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: null, body: null, error: msg };
  }
}
