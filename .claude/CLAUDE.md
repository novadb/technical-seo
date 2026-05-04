# technical-seo

CLI tool for technical SEO audits. Fetches a URL, inspects HTTP headers and HTML, prints a categorized report.

Distribution: `npx github:novadb/technical-seo <url>` (compiles via `prepare` on first install).

## Stack

- TypeScript (ESM, `"type": "module"`), Node ≥ 18.17
- Dependencies: `cheerio` (HTML parsing), `picocolors` (terminal colors)
- Build: `tsc` → `dist/`; dev runner: `tsx`
- No test framework configured

## Layout

- `bin/technical-seo.js` — CLI entry, invokes `dist/index.js`
- `src/index.ts` — arg parsing, orchestration, exit codes
- `src/fetcher.ts` — HTTP fetch + redirect tracking
- `src/parser.ts` — cheerio-based DOM extraction
- `src/reporter.ts` — grouped console output with status icons
- `src/types.ts` — `Finding`, `CheckResult`, severity enums
- `src/checks/*.ts` — one file per audit category, re-exported from `checks/index.ts`

## Conventions

- Each check returns `Finding[]` with `status` (`ok`/`warn`/`fail`/`info`), `priority`, optional `fix` hint
- Exit codes: `0` clean, `1` has ❌, `2` arg/fetch error
- Respect `--no-color` and `NO_COLOR` env
- When adding a check category, create `src/checks/<name>.ts` and register in `src/checks/index.ts`

## Commands

- `npm run dev <url>` — run via tsx without build
- `npm run build` — compile to `dist/`
- `npm start <url>` — run the built CLI
