# Security and Privacy

Website Readiness Checker makes outbound HTTP requests to user-selected sites. The controls below reduce specific risks; they do not make arbitrary network access risk-free or establish an absolute security guarantee.

## URL and destination validation

- `UrlValidator` normalizes URLs, rejects unsupported schemes and malformed input, and strips userinfo credentials.
- `SecurityGuard` permits only ports 80 and 443 and rejects blocked local/internal hostname suffixes and direct IP encodings.
- IPv4 policy blocks loopback, private RFC 1918, link-local/metadata, shared carrier-grade NAT, benchmarking, protocol-assignment and documentation ranges, multicast, reserved, and broadcast destinations.
- IPv6 policy blocks unspecified/loopback, unique-local, link-local, multicast, deprecated site-local, IPv4-mapped IPv6, and IPv4-compatible forms whose embedded IPv4 destination is blocked.
- `DnsSafetyGuard` checks every resolved address before connecting. The Undici connection uses pinned, verified addresses rather than resolving the hostname again at connection time.
- Redirects are handled manually. Each destination is normalized and revalidated for hostname, port, SSRF policy, and DNS safety before the next request.

## Request boundaries

Central limits in `src/scanner/limits.ts` currently include:

| Boundary | Value | Scope |
| --- | ---: | --- |
| Pages | 50 | Per execution |
| Crawl depth | 3 | From the starting page |
| Redirects | 5 | Per request chain |
| HTTP requests | 150 | Per execution, including redirect hops and resource requests |
| Request timeout | 8 seconds | Per outbound request |
| Scan duration | 60 seconds | Per execution, from `executeScan()` start |
| Response body | 3 MiB | Per response |
| HTML parsing | 2 MiB | Per HTML document |
| Sitemap URLs | 250 | Per sitemap processing budget |
| Sampled assets | 5 | Per page |

Resource sampling attempts `HEAD` first and makes a bounded `GET` fallback for unsupported `HEAD` responses (405/501). Both attempts and redirects count toward the execution request budget. Continuation batches receive independent execution budgets; the application does not implement a cumulative session-wide request or duration cap.

SafeFetcher links its request timeout with the scan abort signal, bounds streamed response bytes, filters sensitive response headers before storage, and destroys the Undici dispatcher on response completion and early failure paths.

## Abuse controls and server handling

- The process-local rate limiter permits at most 3 concurrent scans and 15 scan starts per client IP in a 5-minute window by default.
- Direct socket IP is used unless `TRUST_PROXY=true` or `1`; when enabled, the first `X-Forwarded-For` entry is used. This option should only be enabled behind a correctly configured trusted proxy.
- Client aborts and server shutdown propagate cancellation to active scan operations. SSE uses explicit terminal events and the frontend treats an unexpected clean EOF as an error.
- API responses for raw scans and audits use private/no-store cache headers. Express suppresses `X-Powered-By` and sets `X-Content-Type-Options` and `Referrer-Policy`.
- Raw scan results and browser-side audit sessions are in memory. The server retains up to 50 recent scans; restart clears them. There is no persistent database in the current implementation.

## Confirmed limitation

The scan can stop awaiting DNS work when its abort/deadline signal fires, but Node's native `dns.lookup` operation cannot be directly cancelled. The resolver may finish asynchronously after the scan has stopped waiting.

For scanner and application architecture, see [Architecture](./architecture.md). For verification limits, see [Testing and verification](./testing.md).
