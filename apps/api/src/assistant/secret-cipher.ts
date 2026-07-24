import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`inventory-ai-secrets:${secret}`).digest();
}

export function encryptApiKeys(apiKeys: string[], secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(apiKeys), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv, authTag, encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decryptApiKeys(payload: string, secret: string): string[] {
  const [version, ivEncoded, authTagEncoded, encryptedEncoded] = payload.split('.');
  if (version !== VERSION || !ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error('Định dạng khóa AI đã mã hóa không hợp lệ');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret),
    Buffer.from(ivEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString('utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
    throw new Error('Danh sách khóa AI không hợp lệ');
  }
  return parsed;
}
