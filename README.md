# technical-seo

CLI for a complete technical SEO audit of any URL. Fetches the raw HTML, inspects HTTP headers and document structure, and prints a compact, categorized report with status icons, concrete fix hints, and prioritization.

## Quick start

```bash
npx github:novadb/technical-seo https://example.com
```

On first invocation, npx clones the repo and compiles the TypeScript automatically (via the `prepare` script). Requirement: **Node.js 18.17 or newer**.

## Options

```
technical-seo <url> [--no-color]

  -h, --help       Show help
  -v, --version    Print version
      --no-color   Disable colored output (also via NO_COLOR env)
```

If the `https://` prefix is missing, it is added automatically.

## Example output (truncated)

```
Technical SEO Audit
URL:        https://example.com
Status:     200   Redirects: 0
Language:   en
Title:      Example Domain

🌐 HTTP Response
  ✅ HTTP status — 200 OK. Priority: High
  ✅ Redirect chain — No redirects. Priority: High
  ✅ HTTPS — HTTPS end-to-end. Priority: High
  ⚠️ Content-Encoding — No compression — performance drawback. Fix: Enable gzip or brotli on the web server. Priority: Medium

🏷️  Meta & Head
  ❌ Meta Description — Completely missing. Fix: <meta name="description" content="…">. Priority: High
  ...

— Summary —
✅ 18  ❌ 2  ⚠️ 5  ℹ️ 1
2 critical issue(s) found — please fix.
```

Exit code: `0` when there are no ❌ findings, `1` on at least one ❌, `2` on argument or fetch errors.

## What is checked?

10 categories, each in its own `.ts` file under `src/checks/`:

1. **HTTP Response** — Status, redirect chain, HTTPS, Content-Type, charset, Content-Encoding, X-Robots-Tag, Link header
2. **Document Foundation** — HTML5 doctype, meta refresh
3. **Meta & Head** — Title, description, keywords, html lang, canonical (HTML + header), robots, charset, viewport
4. **Heading Structure** — Single H1, empty H1, hierarchy, count
5. **Images** — Alt attribute, missing count, alt quality
6. **Open Graph** — og:title, og:description, og:image (absolute), og:url, og:type, og:locale
7. **Twitter Cards** — twitter:card, twitter:title, twitter:description, twitter:image
8. **Hreflang** — Presence, absolute URL, BCP-47, x-default, self-reference, duplicates (HTML and Link header)
9. **Structured Data** — JSON-LD parsing, @type detection, required-field check
10. **Links** — Internal/external distribution, empty/`#` href

## Local development

```bash
git clone https://github.com/novadb/technical-seo.git
cd technical-seo
npm install
npm run dev https://example.com   # via tsx, no build needed
npm run build                     # tsc → dist/
node bin/technical-seo.js https://example.com
```

## License

MIT
