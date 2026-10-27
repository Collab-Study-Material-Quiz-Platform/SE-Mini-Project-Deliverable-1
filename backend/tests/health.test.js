require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');

const mongoConfigured = Boolean(process.env.MONGO_URI);
let server;
let port;

before(async () => {
  if (mongoConfigured) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
    server.once('error', reject);
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

async function getHealth(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: controller.signal,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    clearTimeout(timer);
  }
}

test('GET /api/health reports the expected health-check shape', async () => {
  const { status, body } = await getHealth('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'OK');
  assert.equal(typeof body.uptimeSeconds, 'number');
  assert.ok(body.uptimeSeconds >= 0);
  assert.ok(body.startedAt);
  assert.ok(body.time);
  assert.equal(body.database, mongoConfigured ? 'connected' : 'not configured');
});

test('GET /health is a backwards-compatible alias', async () => {
  const primary = await getHealth('/api/health');
  const alias = await getHealth('/health');
  assert.equal(alias.status, primary.status);
  assert.equal(alias.body.status, primary.body.status);
  assert.equal(alias.body.database, primary.body.database);
});
