const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');

let server;
let port;

// Start server before tests
const serverReady = new Promise((resolve) => {
  server = app.listen(0, () => {
    port = server.address().port;
    resolve();
  });
});

test('GET /health returns 200 with expected shape', async () => {
  await serverReady;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'OK');
    assert.strictEqual(typeof body.uptimeSeconds, 'number');
    assert.ok(body.startedAt, 'startedAt should be present');
    assert.ok(body.time, 'time should be present');
    assert.ok(typeof body.database === 'string', 'database should be a string');
  } finally {
    clearTimeout(timeout);
  }
});

after(() => {
  server.close();
});
