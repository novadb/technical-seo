import type { FetchResult, RedirectHop } from "./types.js";

const MAX_HOPS = 10;
const USER_AGENT = "technical-seo/0.1 (+npx github:novadb/technical-seo)";

export async function fetchWithRedirectChain(inputUrl: string): Promise<FetchResult> {
  const chain: RedirectHop[] = [];
  let currentUrl = inputUrl;
  let schemeDowngrade = false;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const startedAt = performance.now();
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const ttfbMs = performance.now() - startedAt;

    const status = response.status;
    const location = response.headers.get("location");

    if (status >= 300 && status < 400 && location) {
      const nextUrl = new URL(location, currentUrl).toString();
      const fromScheme = new URL(currentUrl).protocol;
      const toScheme = new URL(nextUrl).protocol;
      if (fromScheme === "https:" && toScheme === "http:") {
        schemeDowngrade = true;
      }
      chain.push({ url: currentUrl, status, location: nextUrl });
      currentUrl = nextUrl;
      // Drain body so the connection can close cleanly
      await response.arrayBuffer().catch(() => undefined);
      continue;
    }

    const rawHtml = await response.text();
    const totalMs = performance.now() - startedAt;
    const htmlBytes = Buffer.byteLength(rawHtml, "utf8");
    return {
      inputUrl,
      finalUrl: currentUrl,
      redirectChain: chain,
      status,
      headers: response.headers,
      rawHtml,
      schemeDowngrade,
      ttfbMs,
      totalMs,
      htmlBytes,
    };
  }

  throw new Error(`Too many redirects (>${MAX_HOPS}) starting from ${inputUrl}`);
}

export interface ProbeResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

export async function probeUrl(url: string, timeoutMs = 5000): Promise<ProbeResult> {
  const headResult = await tryFetch(url, "HEAD", timeoutMs);
  if (headResult.status === 405 || headResult.status === 501) {
    return tryFetch(url, "GET", timeoutMs);
  }
  return headResult;
}

async function tryFetch(url: string, method: "HEAD" | "GET", timeoutMs: number): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": USER_AGENT },
    });
    if (method === "GET") await response.arrayBuffer().catch(() => undefined);
    return { ok: response.ok, status: response.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: null, error: msg };
  }
}
