import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
// Kept independent of framework imports so encryption and state checks are testable.
function keyBuffer(key: string) { if (!/^[a-f\d]{64}$/i.test(key)) throw new Error('A 32-byte encryption key is required.'); return Buffer.from(key, 'hex'); }
export function encryptToken(value: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(key), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function decryptToken(value: string, key: string): string {
  const pieces = value.split('.');
  if (pieces.length !== 3) throw new Error('Invalid encrypted token.');
  const [iv, tag, encrypted] = pieces.map(part => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
export function equalState(expected: string, actual: string) {
  const a = Buffer.from(expected), b = Buffer.from(actual);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
