import type { FetchResult, RedirectHop } from "./types.js";

const MAX_HOPS = 10;
const USER_AGENT = "technical-seo/0.1 (+npx github:novadb/technical-seo)";

export async function fetchWithRedirectChain(inputUrl: string): Promise<FetchResult> {
  const chain: RedirectHop[] = [];
  let currentUrl = inputUrl;
  let schemeDowngrade = false;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

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
    return {
      inputUrl,
      finalUrl: currentUrl,
      redirectChain: chain,
      status,
      headers: response.headers,
      rawHtml,
      schemeDowngrade,
    };
  }

  throw new Error(`Too many redirects (>${MAX_HOPS}) starting from ${inputUrl}`);
}
