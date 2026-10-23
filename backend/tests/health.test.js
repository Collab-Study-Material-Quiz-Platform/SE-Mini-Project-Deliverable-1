const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');

let server;
let port;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function getHealth(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`http://localhost:${port}${path}`, { signal: controller.signal });
    const body = await res.json();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

test('GET /api/health returns 200 with expected shape (no MONGO_URI)', async () => {
  const { status, body } = await getHealth('/api/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.status, 'OK');
  assert.strictEqual(typeof body.uptimeSeconds, 'number');
  assert.ok(body.startedAt, 'startedAt should be present');
  assert.ok(body.time, 'time should be present');
  assert.strictEqual(body.database, 'not configured');
});

test('GET /health alias returns 200 (same response as /api/health)', async () => {
  const { status, body } = await getHealth('/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.status, 'OK');
  assert.strictEqual(typeof body.uptimeSeconds, 'number');
  assert.strictEqual(body.database, 'not configured');
});
