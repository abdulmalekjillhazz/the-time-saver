import crypto from 'node:crypto';
import { randomToken } from './crypto.js';

let argon2Module = undefined;
async function getArgon2() {
  if (argon2Module !== undefined) return argon2Module;
  try {
    argon2Module = await import('@node-rs/argon2');
  } catch {
    argon2Module = null;
  }
  return argon2Module;
}

function scryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function scryptVerify(stored, password) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(String(password), salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

export async function hashPassword(password) {
  const argon2 = await getArgon2();
  if (argon2?.hash) {
    try {
      return await argon2.hash(password);
    } catch {
      // fall through to built-in scrypt
    }
  }
  return scryptHash(password);
}

export async function verifyPassword(stored, password) {
  try {
    if (!stored || typeof stored !== 'string') return false;
    if (stored.startsWith('scrypt$')) {
      return scryptVerify(stored, password);
    }
    const argon2 = await getArgon2();
    if (argon2?.verify) {
      return await argon2.verify(stored, password);
    }
    return false;
  } catch {
    return false;
  }
}

let dummyHashCache = null;
export async function burnPasswordTime(password) {
  try {
    if (!dummyHashCache) {
      dummyHashCache = await hashPassword(randomToken(16));
    }
    await verifyPassword(dummyHashCache, password);
  } catch {
    // ignore timing burn errors
  }
}
