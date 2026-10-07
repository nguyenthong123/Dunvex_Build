import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `dunvex-telegram-${process.pid}.db`);
process.env.NODE_ENV = 'test';
process.env.DUNVEX_DB_PATH = dbPath;
process.env.N8N_ALERT_HUB_URL = 'https://n8n.test.invalid/webhook';

const db = await import('./db.js');
const { dispatchNewOrderNotification } = await import('./telegram-helper.js');
db.load();

test('new synced orders are sent once through the n8n Alert Hub', async (t) => {
  const ownerId = `telegram_owner_${Date.now()}`;
  db.create('api_keys', {
    ownerId,
    telegramBotToken: 'test-bot-token',
    telegramGroupChatId: '-100123456',
    enabled: true,
    notifyNewOrder: true,
  });

  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200 };
  };

  await dispatchNewOrderNotification(ownerId, {
    id: 'order-test-1',
    orderCode: 'DH-<1>',
    customerName: 'Công ty A & B',
    totalAmount: 125000,
    status: 'Đơn chốt',
    createdByDisplayName: 'Nhân viên',
  }, 'sync');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://n8n.test.invalid/webhook');
  const n8nPayload = JSON.parse(calls[0].options.body);
  assert.equal(n8nPayload.ownerId, ownerId);
  assert.equal(n8nPayload.eventType, 'order');
  assert.equal(n8nPayload.botToken, 'test-bot-token');
  assert.equal(n8nPayload.chatId, '-100123456');
  assert.match(n8nPayload.message, /DH-&lt;1&gt;/);
  assert.match(n8nPayload.message, /Công ty A &amp; B/);
  assert.match(n8nPayload.message, /125\.000 đ/);
});

test('failed n8n delivery does not fall back to direct Telegram for orders', async (t) => {
  const ownerId = `telegram_n8n_failure_${Date.now()}`;
  db.create('api_keys', {
    ownerId,
    telegramBotToken: 'test-bot-token',
    telegramGroupChatId: '-100123456',
    enabled: true,
    notifyNewOrder: true,
  });

  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: false, status: 503 };
  };
  console.error = () => {};

  await dispatchNewOrderNotification(ownerId, { id: 'order-test-failure' }, 'sync');

  assert.deepEqual(calls, ['https://n8n.test.invalid/webhook']);
});

test('new order notifications respect the disabled setting', async (t) => {
  const ownerId = `telegram_disabled_${Date.now()}`;
  db.create('api_keys', {
    ownerId,
    telegramBotToken: 'test-bot-token',
    telegramGroupChatId: '-100123456',
    enabled: true,
    notifyNewOrder: false,
  });

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    assert.fail('Telegram should not be called when order notifications are disabled');
  };

  await dispatchNewOrderNotification(ownerId, { id: 'order-test-2' }, 'batch');
});

test.after(() => {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});
