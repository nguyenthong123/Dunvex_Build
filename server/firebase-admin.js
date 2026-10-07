import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

if (getApps().length === 0) {
  let sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa && sa.startsWith("'") && sa.endsWith("'")) {
    sa = sa.slice(1, -1);
  }
  if (sa) {
    initializeApp({ credential: cert(JSON.parse(sa)) });
  } else {
    initializeApp();
  }
}

export const adminAuth = getAuth();
