# Testing and Verification

## Project commands

Defined in `package.json`:

| Command | Purpose |
| --- | --- |
| `npm test` | Runs `tsx --test test/**/*.test.ts` across the test directory |
| `npm run lint` | Runs `tsc --noEmit` |
| `npm run build` | Builds the Vite client and bundles `server.ts` into `dist/server.cjs` |

The unrestricted test command includes integration/e2e files that may make external network requests. Do not use it for a no-network verification run without first reviewing the selected tests.

## Latest safe audit selection

The latest recorded safe deterministic run selected these 16 test files:

- `audit.test.ts`
- `mapped-ipv6-security.test.ts`
- `phase4-1-incremental.test.ts`
- `phase4-pdf-security-regression.test.ts`
- `phase4-report.test.ts`
- `phase5-1-security-fixes.test.ts`
- `phase5-3-accuracy-fixes.test.ts`
- `phase5-4-ux-a11y.test.ts`
- `phase5-5-production-launch.test.ts`
- `report-routing.test.ts`
- `resource-analyzer-budget.test.ts`
- `safe-fetcher-timeout.test.ts`
- `scan-duration-timeout.test.ts`
- `scanner-failure-propagation.test.ts`
- `scan-sse-modals.test.ts`
- `url-scan-input-sse.test.ts`

The final run passed all **178 tests across 16 files**. The `198.18.0.0/15` case in `scanner.test.ts` was also run in isolation (**1 passed, 0 failed**). The following were excluded from the safe selection: `phase5-2-privacy-fixes.test.ts`, `phase5-5-e2e-user-journey.test.ts`, and the remainder of `scanner.test.ts`.

Focused coverage includes DNS/IP policy, redirect and request budgets, resource fallback, response-body timeouts and cleanup, execution-level duration timeout, failure/cancellation propagation, incremental retries/aggregation, report route loading, and SSE terminal/EOF behavior. HTTP integration fixtures use loopback servers and mocked DNS.

## Reproducing the safe file selection on Windows

From the project root in PowerShell:

```powershell
$env:NODE_ENV = 'test'
$excluded = @('phase5-2-privacy-fixes.test.ts', 'phase5-5-e2e-user-journey.test.ts', 'scanner.test.ts')
$files = Get-ChildItem .\test -Filter *.test.ts |
  Where-Object { $excluded -notcontains $_.Name } |
  Sort-Object Name
& npx.cmd tsx --test --test-reporter=spec $files.FullName
```

Run the isolated security case separately:

```powershell
$env:NODE_ENV = 'test'
npx.cmd tsx --test --test-name-pattern='blocks the full 198\.18' .\test\scanner.test.ts
```

If a test name changes, select the exact current test before using the isolated command; do not use a broad pattern that can select unrelated network tests.

## Verification record

The final local verification recorded 178/178 selected tests across 16 files passing, the isolated benchmarking-range regression passing, `npm run lint` passing, and `npm run build` passing. The build emits a non-fatal warning for a JavaScript chunk larger than 500 kB. Documentation/Git setup verification should be reported separately from this application verification.

No public scan or external DNS request is required by the safe selection described above. The excluded tests must not be described as passing in a no-network verification run.
