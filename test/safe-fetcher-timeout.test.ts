import http from 'node:http';
import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from 'undici';
import { SafeFetcher } from '../src/scanner/fetcher';
import { SCANNER_LIMITS } from '../src/scanner/limits';
import { DnsSafetyGuard, type VerifiedDnsResult } from '../src/scanner/dns-safety';
import { SecurityGuard } from '../src/scanner/security-guard';

function mockLocalDns(t: TestContext): void {
  const verifiedDns: VerifiedDnsResult = {
    hostname: '127.0.0.1',
    resolvedIps: ['127.0.0.1'],
    primaryIp: '127.0.0.1',
  };

  const localLookup: ReturnType<typeof DnsSafetyGuard.createPinnedLookup> = (
    _hostname,
    options,
    callback
  ) => {
    const records = [{ address: '127.0.0.1', family: 4 }];
    if (options?.all) callback(null, records);
    else callback(null, records[0].address, records[0].family);
  };

  t.mock.method(SecurityGuard, 'validateHostAndPort', () => {});
  t.mock.method(DnsSafetyGuard, 'resolveAndVerify', async () => verifiedDns);
  t.mock.method(DnsSafetyGuard, 'createPinnedLookup', () => localLookup);
}

async function listenLocally(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return (server.address() as { port: number }).port;
}

async function closeLocally(server: http.Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('SafeFetcher request timeout', () => {
  it('reports every HTTP redirect hop to the request budget callback', async (t) => {
    const server = http.createServer((request, response) => {
      if (request.url === '/start') {
        response.writeHead(302, { location: '/final' });
        response.end();
      } else {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('redirected response');
      }
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalDns(t);
    const requestedUrls: string[] = [];

    const result = await SafeFetcher.fetch(`http://127.0.0.1:${port}/start`, {
      onRequest: (url) => requestedUrls.push(url),
    });

    assert.equal(result.data.redirects.length, 1);
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls[0].endsWith('/start'));
    assert.ok(requestedUrls[1].endsWith('/final'));
  });

  it('destroys the dispatcher when declared content length exceeds the response limit', async (t) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, {
        'content-type': 'text/plain',
        'content-length': '1024',
      });
      response.flushHeaders();
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalDns(t);

    const dispatcherDestroyStacks: string[] = [];
    const originalDestroy = Agent.prototype.destroy;
    t.mock.method(Agent.prototype, 'destroy', function (this: Agent, ...args: Parameters<Agent['destroy']>) {
      dispatcherDestroyStacks.push(new Error().stack || '');
      return originalDestroy.apply(this, args);
    });

    await assert.rejects(
      SafeFetcher.fetch(`http://127.0.0.1:${port}/large`, { maxBytes: 100 }),
      (error: { code?: string }) => error.code === 'RESPONSE_TOO_LARGE'
    );

    assert.ok(
      dispatcherDestroyStacks.some((stack) => stack.includes('fetcher.ts')),
      'SafeFetcher must destroy its dispatcher when rejecting the oversized response'
    );
  });

  it('aborts a stalled response body after headers have arrived', async (t) => {
    let headersSent!: () => void;
    const responseHeadersSent = new Promise<void>((resolve) => {
      headersSent = resolve;
    });
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.flushHeaders();
      response.write('initial body chunk');
      headersSent();
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalDns(t);

    const originalTimeout = SCANNER_LIMITS.requestTimeoutMs;
    SCANNER_LIMITS.requestTimeoutMs = 1000;
    t.after(() => {
      SCANNER_LIMITS.requestTimeoutMs = originalTimeout;
    });

    const fetchPromise = SafeFetcher.fetch(`http://127.0.0.1:${port}/stalled`);
    const timeoutResult = assert.rejects(fetchPromise, (error: { code?: string }) =>
      error.code === 'CONNECTION_TIMEOUT'
    );
    await responseHeadersSent;
    await timeoutResult;
  });

  it('still reads and returns a normally completed response body', async (t) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('complete response body');
    });
    t.after(() => closeLocally(server));
    const port = await listenLocally(server);
    mockLocalDns(t);

    const result = await SafeFetcher.fetch(`http://127.0.0.1:${port}/complete`);

    assert.equal(result.data.statusCode, 200);
    assert.equal(result.bodyText, 'complete response body');
  });
});
