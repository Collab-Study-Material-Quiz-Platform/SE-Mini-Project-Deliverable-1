// server.js reads PORT when it is first loaded, so use a random free port for every test in this file.
process.env.PORT = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const canUseDatabase = Boolean(process.env.MONGO_URI);

test('the API refuses to start without MONGO_URI', async () => {
  const saved = process.env.MONGO_URI;
  delete process.env.MONGO_URI;
  try {
    const { startServer } = require('../server');
    await assert.rejects(startServer(), /MONGO_URI must be configured/);
  } finally {
    if (saved !== undefined) process.env.MONGO_URI = saved;
  }
});

test('the API connects to MongoDB before it starts listening', { skip: !canUseDatabase }, async () => {
  const { startServer } = require('../server');
  const server = await startServer();
  try {
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    assert.equal(mongoose.connection.readyState, 1);

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).database, 'connected');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
