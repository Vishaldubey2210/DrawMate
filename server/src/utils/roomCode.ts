import crypto from 'crypto';

// Unambiguous character set (no 0, O, 1, I, L)
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(length: number = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export function normalizeRoomCode(code: string): string {
  return (code || '').trim().toUpperCase();
}
