import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dunvex-db-test-'));
const previousNodeEnv = process.env.NODE_ENV;
const previousDbPath = process.env.DUNVEX_DB_PATH;

process.env.NODE_ENV = 'test';
process.env.DUNVEX_DB_PATH = path.join(testDir, 'test.sqlite');

const database = await import('./db.js');
const { createSession, resolveSession, revokeSession } = await import('./auth-session.js');
const express = (await import('express')).default;
const authRouter = (await import('./routes/auth.js')).default;
database.load(path.join(testDir, 'no-migration-source.json'));

after(() => {
  database.close();
  fs.rmSync(testDir, { recursive: true, force: true });
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDbPath === undefined) delete process.env.DUNVEX_DB_PATH;
  else process.env.DUNVEX_DB_PATH = previousDbPath;
});

test('withTransaction rolls back every write when a batch operation fails', () => {
  assert.throws(() => {
    database.withTransaction(() => {
      database.create('orders', { ownerId: 'test-owner' }, 'test-order');
      database.create('debts', { ownerId: 'test-owner', orderId: 'test-order' }, 'test-debt');
      throw new Error('simulated batch failure');
    });
  }, /simulated batch failure/);

  assert.equal(database.getById('orders', 'test-order'), null);
  assert.equal(database.getById('debts', 'test-debt'), null);
});

test('withTransaction commits every write when the batch succeeds', () => {
  database.withTransaction(() => {
    database.create('orders', { ownerId: 'test-owner' }, 'committed-order');
    database.create('debts', { ownerId: 'test-owner', orderId: 'committed-order' }, 'committed-debt');
  });

  assert.equal(database.getById('orders', 'committed-order')?.ownerId, 'test-owner');
  assert.equal(database.getById('debts', 'committed-debt')?.orderId, 'committed-order');
});

test('SQLite sessions store only a token hash and resolve the authoritative owner', () => {
  const user = {
    id: 'session-user',
    uid: 'session-user',
    email: 'owner@example.com',
    ownerId: 'tenant-owner',
    role: 'admin',
    password: 'password-hash',
  };
  database.create('users', user, user.id);

  const session = createSession(user);
  const storedSessions = database.getAll('sessions');

  assert.ok(session.token);
  assert.equal(resolveSession(session.token)?.user.ownerId, 'tenant-owner');
  assert.equal('password' in resolveSession(session.token).user, false);
  assert.equal(JSON.stringify(storedSessions).includes(session.token), false);
  assert.equal(revokeSession(session.token), true);
  assert.equal(resolveSession(session.token), null);
});

test('expired SQLite sessions are rejected and removed', () => {
  const user = { id: 'expired-user', uid: 'expired-user', email: 'expired@example.com' };
  database.create('users', user, user.id);
  const createdAt = Date.now();
  const session = createSession(user, createdAt);

  assert.equal(resolveSession(session.token, Date.parse(session.expiresAt) + 1), null);
});

test('SQLite email login returns a session and logout revokes it', async (context) => {
  database.create('users', {
    id: 'login-user',
    uid: 'login-user',
    email: 'login@example.com',
    ownerId: 'login-owner',
    role: 'admin',
    password: 'legacy-password',
  }, 'login-user');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'login@example.com', password: 'legacy-password' }),
  });
  const loginData = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.ok(loginData.sessionToken);
  assert.equal(loginData.user.ownerId, 'login-owner');
  assert.equal('password' in loginData.user, false);
  assert.match(database.getById('users', 'login-user').password, /^[a-f0-9]+:/);

  const sessionResponse = await fetch(`${baseUrl}/session`, {
    headers: { Authorization: `Bearer ${loginData.sessionToken}` },
  });
  assert.equal(sessionResponse.status, 200);

  const logoutResponse = await fetch(`${baseUrl}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginData.sessionToken}` },
  });
  assert.equal(logoutResponse.status, 200);
  const expiredResponse = await fetch(`${baseUrl}/session`, {
    headers: { Authorization: `Bearer ${loginData.sessionToken}` },
  });
  assert.equal(expiredResponse.status, 401);

  const unknownPasswordResponse = await fetch(`${baseUrl}/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.com', password: 'password123' }),
  });
  assert.equal(unknownPasswordResponse.status, 404);
  assert.equal((database.getAll('users') || []).some(user => user.email === 'unknown@example.com'), false);

  const wrongPasswordResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'login@example.com', password: 'wrong-password' }),
  });
  assert.equal(wrongPasswordResponse.status, 401);
  assert.equal(database.getById('users', 'login-user')?.ownerId, 'login-owner');
});