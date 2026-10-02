/**
 * Express + Vite Server Entry Point (Phase 2 - Secure Scanner Backend)
 *
 * Runs Express on port 3000 (0.0.0.0).
 * Mounts server-side scanner endpoints at /api/* before Vite middleware.
 * Ensures all website scanning is strictly isolated to the server boundary.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  ScanOrchestrator,
  globalRateLimiter,
  globalScanStore,
  sanitizeScannerError,
  ScannerException,
  ScanProgressEvent,
} from './src/scanner';
import { runAudit } from './src/audit';

export interface ActiveScanContext {
  scanId: string;
  abort: () => void;
  res?: express.Response;
}

const activeScans = new Set<ActiveScanContext>();
let isShuttingDown = false;

export function getActiveScanCount(): number {
  return activeScans.size;
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

export function resetServerState(): void {
  isShuttingDown = false;
  activeScans.clear();
}

/**
 * Gracefully shuts down active scanner operations, SSE streams, and HTTP listener.
 */
export async function shutdownServer(
  server: http.Server | null,
  timeoutMs = 5000
): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  // 1. Abort all active scans and cleanly close SSE client streams
  for (const scan of Array.from(activeScans)) {
    try {
      if (scan.res && !scan.res.writableEnded) {
        scan.res.write(`event: server_shutdown\ndata: ${JSON.stringify({ message: 'Server is shutting down.' })}\n\n`);
        scan.res.end();
      }
      scan.abort();
    } catch {
      // Ignore individual cleanup errors
    }
  }
  activeScans.clear();

  // 2. Close HTTP server cleanly within timeout boundary
  if (server) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, timeoutMs);
      timer.unref?.();

      server.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

/**
 * Safely resolves the client IP address for rate limiting.
 * By default, uses the direct socket peer address unless TRUST_PROXY is explicitly enabled.
 * Normalizes IPv4-mapped IPv6 addresses for consistent rate limit tracking.
 */
export function getClientIp(req: express.Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  let rawIp: string | undefined;

  if (trustProxy && req.headers['x-forwarded-for']) {
    const forwarded = Array.isArray(req.headers['x-forwarded-for'])
      ? req.headers['x-forwarded-for'][0]
      : req.headers['x-forwarded-for'];
    rawIp = forwarded.split(',')[0].trim();
  }

  if (!rawIp) {
    rawIp = req.socket.remoteAddress || '127.0.0.1';
  }

  // Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1 -> 127.0.0.1)
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.slice(7);
  }

  return rawIp;
}

export function createApp(): express.Express {
  const app = express();

  // A. Disable Express framework disclosure
  app.disable('x-powered-by');

  // B & C. Basic HTTP privacy/security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Parse JSON payloads up to 128 KB
  app.use(express.json({ limit: '128kb' }));

  // Production health and readiness endpoint
  const handleHealth = (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (isShuttingDown) {
      res.status(503).json({
        status: 'shutting_down',
        service: 'website-readiness-checker',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      status: 'ok',
      service: 'website-readiness-checker',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeScans: activeScans.size,
      rateLimiter: globalRateLimiter.getStats(),
    });
  };

  app.get(['/api/health', '/health'], handleHealth);
  app.head(['/api/health', '/health'], handleHealth);

  // Get raw scan result by ID (private, no-store)
  app.get('/api/scan/:id', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    const scan = globalScanStore.get(req.params.id);
    if (!scan) {
      res.status(404).json({
        error: 'Scan not found',
        message: `No scan found with identifier "${req.params.id}"`,
      });
      return;
    }
    res.json(scan);
  });

  // Run or retrieve deterministic Phase 3 Audit for a scan ID (private, no-store)
  app.get('/api/audit/:id', (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    const scan = globalScanStore.get(req.params.id);
    if (!scan) {
      res.status(404).json({
        error: 'Scan not found',
        message: `No scan found with identifier "${req.params.id}"`,
      });
      return;
    }
    const auditResult = runAudit(scan);
    res.json(auditResult);
  });

  // Initiate scan with real-time SSE progress streaming or direct JSON response
  app.post('/api/scan', async (req, res) => {
    if (isShuttingDown) {
      res.status(503).json({
        error: 'SERVER_SHUTTING_DOWN',
        message: 'Server is currently shutting down. Please try again shortly.',
      });
      return;
    }

    const {
      url: rawUrl,
      sessionId,
      batchIndex,
      alreadyScannedUrls,
      seedUrls,
      allDiscoveredUrls,
    } = req.body || {};

    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).json({
        error: 'INVALID_URL',
        message: 'Please provide a valid website URL in the "url" request field.',
      });
      return;
    }

    const batchOptions = {
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      batchIndex: typeof batchIndex === 'number' ? batchIndex : undefined,
      alreadyScannedUrls: Array.isArray(alreadyScannedUrls) ? alreadyScannedUrls : undefined,
      seedUrls: Array.isArray(seedUrls) ? seedUrls : undefined,
      allDiscoveredUrls: Array.isArray(allDiscoveredUrls) ? allDiscoveredUrls : undefined,
    };

    // Abuse / Rate Limiting (secure peer IP identification)
    const clientIp = getClientIp(req);
    let releaseLimit: (() => void) | null = null;
    try {
      releaseLimit = globalRateLimiter.acquire(clientIp);
    } catch (err: unknown) {
      const scanErr = sanitizeScannerError(err);
      res.status(429).json(scanErr);
      return;
    }

    // Client disconnect & server lifecycle cancellation
    const clientAbortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        clientAbortController.abort();
      }
    };
    req.on('aborted', onClose);
    res.on('close', onClose);

    const scanContext: ActiveScanContext = {
      scanId: `scan-ctx-${Date.now()}`,
      abort: () => clientAbortController.abort(),
      res,
    };
    activeScans.add(scanContext);

    const wantsStream =
      req.headers.accept?.includes('text/event-stream') ||
      req.query.stream === 'true' ||
      req.body?.stream === true;

    if (wantsStream) {
      // Set Server-Sent Events headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const sendSse = (type: string, data: unknown) => {
        if (!res.writableEnded) {
          res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      try {
        const result = await ScanOrchestrator.executeScan(rawUrl, {
          ...batchOptions,
          abortSignal: clientAbortController.signal,
          onProgress: (progress: ScanProgressEvent) => {
            sendSse('progress', progress);
          },
        });

        if (result.status === 'failed') {
          const failure = result.errors[0];
          sendSse('scan_error', failure || {
            code: 'REQUEST_FAILED',
            message: 'The scan could not be completed.',
          });
        } else {
          // Store only scans that produced a usable result
          globalScanStore.set(result);
          sendSse('completed', result);
        }
        if (!res.writableEnded) res.end();
      } catch (err: unknown) {
        if (clientAbortController.signal.aborted) {
          sendSse('cancelled', { message: 'Scan cancelled by client.' });
        } else {
          const scanError = sanitizeScannerError(err, rawUrl);
          sendSse('scan_error', scanError);
        }
        if (!res.writableEnded) res.end();
      } finally {
        activeScans.delete(scanContext);
        req.off('aborted', onClose);
        res.off('close', onClose);
        if (releaseLimit) releaseLimit();
        if (!res.writableEnded) res.end();
      }
    } else {
      // Standard JSON response (private, no-store)
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      try {
        const result = await ScanOrchestrator.executeScan(rawUrl, {
          ...batchOptions,
          abortSignal: clientAbortController.signal,
        });
        globalScanStore.set(result);
        res.json(result);
      } catch (err: unknown) {
        if (clientAbortController.signal.aborted) {
          res.status(499).json({ error: 'CLIENT_CLOSED_REQUEST', message: 'Scan was cancelled.' });
          return;
        }
        const scanError = sanitizeScannerError(err, rawUrl);
        const statusCode = err instanceof ScannerException && err.code === 'INVALID_URL' ? 400 : 500;
        res.status(statusCode).json(scanError);
      } finally {
        activeScans.delete(scanContext);
        req.off('aborted', onClose);
        res.off('close', onClose);
        if (releaseLimit) releaseLimit();
      }
    }
  });

  // Production error-handling middleware (prevents unhandled stack trace leaks)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isScannerEx = err instanceof ScannerException;
    const sanitized = sanitizeScannerError(err);
    const statusCode = isScannerEx && err.code === 'INVALID_URL' ? 400 : 500;
    res.status(statusCode).json({
      error: sanitized.code,
      message: sanitized.message,
    });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && (__filename.endsWith('.cjs') || __filename.includes('dist')));

  // Vite development middleware or production static files
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Scanner Engine] Server running in ${isProduction ? 'production' : 'development'} on http://0.0.0.0:${PORT}`);
  });

  const handleTermination = async (signal: string) => {
    console.log(`[Scanner Engine] Received ${signal}. Starting graceful shutdown...`);
    await shutdownServer(server);
    process.exit(0);
  };

  process.on('SIGTERM', () => handleTermination('SIGTERM'));
  process.on('SIGINT', () => handleTermination('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[Scanner Engine] Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[Scanner Engine] Uncaught exception:', err instanceof Error ? err.message : String(err));
  });

  return server;
}

const isRunningTests =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((a) => a.includes('--test') || a.includes('test/')) ||
  process.execArgv.includes('--test');

if (!isRunningTests) {
  startServer();
}
