# Phase 5 — Security, Privacy, and Production Readiness

This document records current implementation and verified regressions. It describes the repository as inspected; it is not a claim of absolute security or a record of deployment.

## Security hardening

- URL normalization and restricted-port checks are applied before outbound requests.
- IPv4 policy blocks private, loopback, link-local/metadata, carrier-grade NAT, benchmarking (`198.18.0.0/15`), documentation, multicast, reserved, and broadcast ranges.
- IPv6 policy covers loopback/unspecified, unique-local, link-local, multicast, deprecated site-local (`fec0::/10`), mapped IPv4, and compatible IPv4 forms.
- All DNS results are validated before use. Undici connects using pinned validated addresses; redirect targets receive fresh URL, hostname/port, SSRF, and DNS validation.
- HTTP requests are bounded by per-request timeout, response and HTML byte limits, redirect count, page depth/count, request count, and an execution-level duration deadline.
- Redirect requests and resource `HEAD`/fallback `GET` requests consume the per-execution request budget.
- The response-body reader enforces the byte cap. Response-path cleanup destroys the dispatcher, including early response rejection.
- The in-memory rate limiter bounds concurrent scans and per-client starts. Proxy-header trust is disabled unless explicitly enabled.

## Scanner and report reliability

- Scanner failures and page-level errors propagate into scan results; failed scans are not presented as successful completion.
- Incremental batches track discovered, attempted, and analyzed pages. Successful retry data supersedes an earlier failed page during merge and matching stale errors are removed.
- Each continuation execution has its own page/request/time budgets. Merged summaries add batch totals; session-wide cumulative caps are not implemented.
- SSE has explicit `completed`, `scan_error`, `cancelled`, and `server_shutdown` terminals. A clean stream end without a terminal event reaches the existing frontend error state and clears active loading.
- Report lookup is tied to the requested scan ID. Missing or failed real lookups do not silently render demo data; explicit demo IDs continue to use demonstration content.
- Cancellation is propagated through the existing abort-signal path. Execution timeout is distinct from per-request timeout and produces the existing timeout/failure or partial-result representation.

## Privacy and lifecycle

- Server scan retention and browser audit sessions are process-local/in-memory. The server store retains up to 50 recent scan results; restart clears them.
- Selected sensitive response headers (`Set-Cookie`, `Cookie`, `Authorization`, `Proxy-Authorization`) are filtered before scan data is stored.
- Scan and audit endpoints use private/no-store cache headers. Express disables `X-Powered-By` and adds `X-Content-Type-Options` and `Referrer-Policy`.
- Client disconnect and graceful server shutdown abort active scanner work; shutdown uses the `server_shutdown` SSE event when the stream is writable.

## Verification evidence

The latest recorded safe audit passed 16 selected test files plus an isolated `198.18.0.0/15` regression, TypeScript checking, and production build. Tests cover scanner security/budgets, DNS and IPv6 cases, timeout/cancellation, failure propagation, incremental aggregation/retry, report routing, SSE EOF/terminal events, and server lifecycle.

See [Testing and verification](../testing.md) for the exact selected test files and exclusions. The unrestricted suite contains tests excluded from no-network verification.

## Known limitations

- Node's native `dns.lookup` cannot be directly cancelled. The scanner stops awaiting it at the execution deadline, but underlying resolver work may finish asynchronously.
- Page, request, and duration limits are per execution/batch, not cumulative across an entire continuation session.
- The production build succeeds with a non-failing warning for a client JavaScript chunk larger than 500 kB.
- In-memory results are not durable, and JavaScript-rendered page content is not executed or inspected.
