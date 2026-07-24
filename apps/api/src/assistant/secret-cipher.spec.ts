import { describe, expect, it } from 'vitest';
import { decryptApiKeys, encryptApiKeys } from './secret-cipher';

describe('AI API key encryption', () => {
  const secret = 'a-dedicated-encryption-secret-with-at-least-32-characters';

  it('round-trips multiple API keys without exposing plaintext', () => {
    const keys = ['gemini-key-primary-123456789', 'gemini-key-backup-987654321'];
    const encrypted = encryptApiKeys(keys, secret);

    expect(encrypted).not.toContain(keys[0]);
    expect(encrypted).not.toContain(keys[1]);
    expect(decryptApiKeys(encrypted, secret)).toEqual(keys);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptApiKeys(['gemini-key-primary-123456789'], secret);

    expect(() => decryptApiKeys(`${encrypted}broken`, secret)).toThrow();
  });
});
