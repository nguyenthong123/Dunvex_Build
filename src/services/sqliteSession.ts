export interface SQLiteSessionUser {
  uid: string;
  id?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  ownerId?: string;
  ownerEmail?: string;
  role?: string;
  createdAt?: string;
  expiresAt?: string | number;
  [key: string]: unknown;
}

const SESSION_USER_KEY = 'dunvex_user_session';
const SESSION_TOKEN_KEY = 'dunvex_session_token';
const SESSION_EXPIRES_KEY = 'dunvex_session_expires_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const listeners = new Set<(user: SQLiteSessionUser | null) => void>();

function readUser(): SQLiteSessionUser | null {
  const token = getSessionToken();
  const rawUser = localStorage.getItem(SESSION_USER_KEY);
  if (!token && !rawUser) return null;

  try {
    const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (expiresAtStr) {
      const expiresAt = Number(expiresAtStr);
      if (expiresAt > 0 && Date.now() > expiresAt) {
        // Session has expired after 7 days
        clearSQLiteSession();
        return null;
      }
    }

    if (!rawUser) return null;
    const user = JSON.parse(rawUser) as SQLiteSessionUser;
    if (user && !user.ownerId && user.uid) {
      user.ownerId = user.uid;
    }
    return user;
  } catch {
    return null;
  }
}

export function getCurrentSessionUser(): SQLiteSessionUser | null {
  return readUser();
}

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_TOKEN_KEY) || '';
}

function notifySessionChange() {
  const user = readUser();
  listeners.forEach((listener) => listener(user));
  window.dispatchEvent(new CustomEvent(user ? 'dunvex_login' : 'dunvex_logout', { detail: user }));
}

export function setSQLiteSession(user: SQLiteSessionUser, token: string, expiresAt?: string | number) {
  const expiryTime = expiresAt 
    ? (typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt)
    : Date.now() + SEVEN_DAYS_MS;

  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem(SESSION_EXPIRES_KEY, String(expiryTime));
  localStorage.setItem('dunvex_owner_id', user.ownerId || user.uid);
  notifySessionChange();
}

export function clearSQLiteSession() {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_EXPIRES_KEY);
  localStorage.removeItem('dunvex_owner_id');
  localStorage.removeItem('dunvex_api_key');
  notifySessionChange();
}

export function onSQLiteAuthStateChanged(callback: (user: SQLiteSessionUser | null) => void) {
  listeners.add(callback);
  callback(readUser());
  return () => listeners.delete(callback);
}

export const auth = {
  get currentUser() {
    const user = readUser();
    if (!user) return null;
    return {
      ...user,
      metadata: { creationTime: user.createdAt || null },
    };
  },
  onAuthStateChanged(callback: (user: SQLiteSessionUser | null) => void) {
    return onSQLiteAuthStateChanged(callback);
  },
};

