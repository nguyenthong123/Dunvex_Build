import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { io as connectSocket } from 'socket.io-client';

const dbPath = path.join(os.tmpdir(), `dunvex-sync-${process.pid}.db`);
process.env.NODE_ENV = 'test';
process.env.DUNVEX_DB_PATH = dbPath;
process.env.N8N_ALERT_HUB_URL = 'https://n8n.test.invalid/webhook';

const db = await import('../db.js');
const syncRouter = (await import('./sync.js')).default;
const { initSignaling } = await import('../signaling.js');
db.load();

test('sync sends each newly finalized order once through n8n', async (t) => {
  const ownerId = `sync_owner_${Date.now()}`;
  db.create('api_keys', {
    ownerId,
    key: 'sync-test-key',
    telegramBotToken: 'test-bot-token',
    telegramGroupChatId: '-100123456',
    enabled: true,
    notifyNewOrder: true,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/sync', syncRouter);
  const server = app.listen(0, '127.0.0.1');
  const signaling = initSignaling(server);
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    signaling.close();
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const socketOrigin = `http://${address.address}:${address.port}`;
  async function registerDevice(deviceId) {
    const socket = connectSocket(socketOrigin, { transports: ['websocket'] });
    await once(socket, 'connect');
    const registered = once(socket, 'device:registered');
    socket.emit('device:register', { ownerId, deviceId, deviceType: 'web' });
    await registered;
    t.after(() => socket.disconnect());
    return socket;
  }
  const senderSocket = await registerDevice('sync-test-device');
  const receiverSocket = await registerDevice('sync-receiver-device');
  let senderWasNotified = false;
  senderSocket.on('sync:remote_data_pushed', () => {
    senderWasNotified = true;
  });

  const n8nCalls = [];
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    n8nCalls.push({ url: String(url), body: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  };

  async function push(changes) {
    const payload = JSON.stringify({ deviceId: 'sync-test-device', changes });
    const response = await new Promise((resolve, reject) => {
      const request = http.request({
        host: address.address,
        port: address.port,
        path: '/api/sync/push',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-owner-id': ownerId,
          'x-api-key': 'sync-test-key',
        },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      request.on('error', reject);
      request.end(payload);
    });
    assert.equal(response.status, 200);
    return response.body;
  }

  const receivedSyncPush = once(receiverSocket, 'sync:remote_data_pushed');
  const draft = {
    id: 'order-sync-draft',
    status: 'Mới',
    updated_at: 1000,
  };
  const draftPush = await push({ orders: [draft] });
  const syncPushEvent = await receivedSyncPush;
  assert.equal(draftPush.new_orders_created, 1);
  assert.equal(syncPushEvent[0].senderDeviceId, 'sync-test-device');
  assert.deepEqual(syncPushEvent[0].affectedTables, ['orders']);
  assert.equal(senderWasNotified, false);
  assert.equal(n8nCalls.length, 0);

  const finalized = { ...draft, status: 'Đơn chốt', updated_at: 2000 };
  const firstFinalize = await push({ orders: [finalized] });
  assert.equal(firstFinalize.new_orders_created, 0);
  assert.equal(n8nCalls.length, 1);
  assert.equal(n8nCalls[0].url, 'https://n8n.test.invalid/webhook');
  assert.equal(n8nCalls[0].body.eventType, 'order');
  assert.equal(n8nCalls[0].body.data.orderId, draft.id);

  const repeatedSync = await push({ orders: [finalized] });
  assert.equal(repeatedSync.new_orders_created, 0);
  assert.equal(n8nCalls.length, 1);

  const createdClosed = await push({
    orders: [{
      id: 'order-sync-closed',
      status: 'Đơn chốt',
      updated_at: 3000,
    }],
  });
  assert.equal(createdClosed.new_orders_created, 1);
  assert.equal(n8nCalls.length, 2);

  const auditLines = [];
  const originalWarn = console.warn;
  console.warn = (...args) => auditLines.push(args);
  let stalePush;
  try {
    stalePush = await push({
      orders: [{
        ...draft,
        updated_at: 1500,
        private_note: 'must not be written to audit log',
      }],
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(stalePush.conflict_count, 1);
  assert.deepEqual(stalePush.rejected_ids, [{
    table: 'orders',
    id: draft.id,
    reason: 'server_newer',
    client_updated_at: 1500,
    server_updated_at: 2000,
  }]);
  const conflictAudit = auditLines.find(([prefix]) => prefix === '[Sync Conflict Audit]');
  assert.ok(conflictAudit);
  const auditEvent = JSON.parse(conflictAudit[1]);
  assert.equal(auditEvent.event, 'sync_conflict');
  assert.equal(auditEvent.ownerId, ownerId);
  assert.equal(auditEvent.deviceId, 'sync-test-device');
  assert.deepEqual(auditEvent.conflictsByTable, { orders: 1 });
  assert.deepEqual(auditEvent.conflicts, [{
    table: 'orders',
    recordId: draft.id,
    reason: 'server_newer',
    clientUpdatedAt: 1500,
    serverUpdatedAt: 2000,
  }]);
  assert.doesNotMatch(conflictAudit[1], /must not be written to audit log/);
});

test('sync pull returns owner-scoped pages without duplicates', async (t) => {
  const ownerId = `paged_sync_owner_${Date.now()}`;
  const apiKey = `paged_sync_key_${Date.now()}`;
  db.create('api_keys', { ownerId, key: apiKey, enabled: true });
  for (let index = 0; index < 5; index++) {
    db.create('customers', {
      id: `paged-customer-${index}`,
      ownerId,
      name: `Customer ${index}`,
    }, `paged-customer-${index}`);
  }
  db.create('customers', {
    id: 'other-owner-customer',
    ownerId: `${ownerId}-other`,
    name: 'Other owner',
  }, 'other-owner-customer');

  const app = express();
  app.use('/api/sync', syncRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const origin = `http://127.0.0.1:${server.address().port}`;
  const received = [];
  let cursor = null;
  do {
    const params = new URLSearchParams({ since: '0', limit: '2' });
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`${origin}/api/sync/pull?${params}`, {
      headers: { 'x-api-key': apiKey, 'x-owner-id': ownerId },
    });
    assert.equal(response.status, 200);
    const page = await response.json();
    received.push(...page.changes.customers);
    cursor = page.next_cursor;
  } while (cursor);

  assert.deepEqual(received.map((row) => row.id).sort(), [
    'paged-customer-0',
    'paged-customer-1',
    'paged-customer-2',
    'paged-customer-3',
    'paged-customer-4',
  ]);
  assert.equal(new Set(received.map((row) => row.id)).size, 5);
});

test.after(() => {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});
