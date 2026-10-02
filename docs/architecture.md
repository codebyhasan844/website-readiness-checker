# Architecture

## Runtime components

- `server.ts` runs Express, serves the client through Vite middleware in development or `dist/` in production, and exposes scan, audit, and health endpoints.
- `src/scanner/` validates input, applies destination policy, resolves and pins DNS answers, fetches bounded responses, discovers pages, and assembles typed `ScanResult` data.
- `src/audit/` evaluates the raw scan deterministically using its registered checks; it does not fetch pages.
- `src/report/` derives findings, coverage, comparisons, checklists, and PDF output.
- `src/components/` renders the scan form, progress, reports, and continuation/rescan flows.

## Scan and report flow

1. The client submits a URL to `POST /api/scan`. Streaming requests receive SSE `progress` events and one terminal event (`completed`, `scan_error`, `cancelled`, or `server_shutdown`).
2. The server validates the URL and destination, verifies DNS answers, and passes bounded work through `ScanOrchestrator`, `SafeFetcher`, robots/sitemap handlers, the crawler, and resource analysis.
3. A usable `ScanResult` is retained by the process-local `globalScanStore`. `GET /api/scan/:id` returns it or `404`; `GET /api/audit/:id` computes a deterministic audit from it.
4. The frontend loads the requested scan ID, runs/uses the audit data to build a report view model, and renders findings and coverage. A missing real scan is shown as a load error rather than a demo report. Explicit demo IDs use sample report data.
5. Incremental audit state is kept in a browser-process in-memory `Map` in `src/report/incremental.ts`. Batches are merged by canonical page URL, with successful page data preferred over a prior failed attempt.

## State and retention

The server retains at most 50 recent raw scans in memory; process restart loses those results. Incremental report sessions are also in-memory and do not represent durable storage. The rate limiter and active-scan tracking are process-local, not shared between server instances.

## API surface

- `POST /api/scan`: submit scan JSON; supports streaming and non-streaming request modes.
- `GET /api/scan/:id`: retrieve retained raw scan data.
- `GET /api/audit/:id`: calculate the audit for a retained scan.
- `GET`/`HEAD /api/health` and `/health`: health and shutdown status.

The exact response and terminal-event handling is implemented in `server.ts` and covered by the server/SSE tests.
