import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_KEY_ENV = 'LARK_INTEGRATION_ENCRYPTION_KEY';

function getEncryptionKey() {
  const value = process.env[ENCRYPTION_KEY_ENV];
  if (!value || !/^[\da-f]{64}$/i.test(value)) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be a 32-byte hexadecimal key`);
  }
  return Buffer.from(value, 'hex');
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

export function decryptSecret(encrypted: string) {
  const packed = Buffer.from(encrypted, 'base64url');
  if (packed.length < 29) throw new Error('Encrypted secret is invalid');
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
