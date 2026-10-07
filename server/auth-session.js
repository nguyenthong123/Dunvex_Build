import crypto from 'node:crypto';
import * as db from './db.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return {
    ...safeUser,
    uid: user.uid || user.id,
    ownerId: user.ownerId || user.uid || user.id,
  };
}

export function createSession(user, now = Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = tokenHash(token);
  const safeUser = publicUser(user);
  const session = {
    id,
    tokenHash: id,
    userId: user.id || user.uid,
    uid: safeUser.uid,
    ownerId: safeUser.ownerId,
    email: safeUser.email || '',
    role: safeUser.role || 'staff',
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
  };

  db.create('sessions', session, id);
  return { token, user: safeUser, expiresAt: session.expiresAt };
}

export function resolveSession(token, now = Date.now()) {
  if (!token || typeof token !== 'string') return null;
  const id = tokenHash(token);
  const session = db.getById('sessions', id);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= now) {
    db.remove('sessions', id);
    return null;
  }

  const user = db.getById('users', session.userId);
  if (!user) return null;
  return { user: publicUser(user), expiresAt: session.expiresAt };
}

export function revokeSession(token) {
  if (!token || typeof token !== 'string') return false;
  return db.remove('sessions', tokenHash(token));
}

export function revokeUserSessions(userId) {
  const sessions = db.getAll('sessions') || [];
  let revoked = 0;
  for (const session of sessions) {
    if (session.userId === userId) {
      db.remove('sessions', session.id);
      revoked++;
    }
  }
  return revoked;
}
