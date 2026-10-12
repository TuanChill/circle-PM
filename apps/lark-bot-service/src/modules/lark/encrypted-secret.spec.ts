import {
  decryptSecret,
  encryptSecret,
} from '../../../../../libs/common/src/utilities/encrypted-secret.util';

describe('Lark integration secret encryption', () => {
  const previousKey = process.env.LARK_INTEGRATION_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.LARK_INTEGRATION_ENCRYPTION_KEY;
    else process.env.LARK_INTEGRATION_ENCRYPTION_KEY = previousKey;
  });

  it('round-trips secrets without storing plaintext in the ciphertext', () => {
    process.env.LARK_INTEGRATION_ENCRYPTION_KEY = 'ab'.repeat(32);

    const ciphertext = encryptSecret('lark-app-secret');

    expect(ciphertext).not.toContain('lark-app-secret');
    expect(decryptSecret(ciphertext)).toBe('lark-app-secret');
  });

  it('rejects tampered ciphertext', () => {
    process.env.LARK_INTEGRATION_ENCRYPTION_KEY = 'ab'.repeat(32);
    const ciphertext = encryptSecret('lark-app-secret');
    const packed = Buffer.from(ciphertext, 'base64url');
    packed[packed.length - 1] ^= 0xff;

    expect(() => decryptSecret(packed.toString('base64url'))).toThrow(
      'Unsupported state or unable to authenticate data',
    );
  });
});
