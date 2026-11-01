// Runs one audit in its own thread so a heavy job never blocks the HTTP server.
import { parentPort, workerData } from 'node:worker_threads';
import { initSandbox } from './sandbox.js';
import { audit } from './core.js';

try {
  const sandbox = await initSandbox();
  const result = audit(workerData, (e) => parentPort.postMessage({ kind: 'event', e }), sandbox);
  parentPort.postMessage({ kind: 'done', result });
} catch (err) {
  parentPort.postMessage({ kind: 'error', message: String((err && err.message) || err) });
}
