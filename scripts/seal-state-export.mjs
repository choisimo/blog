import { readFileSync, writeFileSync } from 'node:fs';
import { createCipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto';
// Export artifacts must contain no plaintext user data. The private key stays
// with the operator; GitHub receives only the public encryption key.
const [input, output] = process.argv.slice(2);
if (!input || !output || !process.env.STATE_EXPORT_PUBLIC_KEY) throw new Error('Export paths and public key are required');
const publicKey = createPublicKey(process.env.STATE_EXPORT_PUBLIC_KEY);
if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 3072) throw new Error('An RSA key of at least 3072 bits is required');
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(readFileSync(input)), cipher.final()]);
const wrapped = publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, key);
const length = Buffer.alloc(4); length.writeUInt32BE(wrapped.length);
writeFileSync(output, Buffer.concat([Buffer.from('BLOGSTATE1'), length, wrapped, iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
console.log('Encrypted state export ready');
