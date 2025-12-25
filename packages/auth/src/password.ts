// Password hashing using Web Crypto API (compatible with Cloudflare Workers)
// This implements PBKDF2 with SHA-256

const ITERATIONS = 100000;
const HASH_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const key = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    HASH_LENGTH * 8
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt);

  // Format: algorithm$iterations$salt$hash
  return `pbkdf2-sha256$${ITERATIONS}$${arrayBufferToBase64(salt.buffer)}$${arrayBufferToBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');

  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    return false;
  }

  const iterations = parseInt(parts[1]!, 10);
  const salt = new Uint8Array(base64ToArrayBuffer(parts[2]!));
  const expectedHash = parts[3]!;

  // Recreate the key derivation params
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const key = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    HASH_LENGTH * 8
  );

  const hashBase64 = arrayBufferToBase64(hash);

  // Constant-time comparison
  if (hashBase64.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hashBase64.length; i++) {
    result |= hashBase64.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return result === 0;
}

export function generateSecureToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToBase64(bytes.buffer).replace(/[+/=]/g, (c) =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}
