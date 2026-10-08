import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Clave hex de 32 bytes (64 caracteres). Nunca enviar al navegador ni guardar en BD. */
function key(): Buffer {
  const raw = (process.env.REPEATER_ENCRYPTION_KEY ?? '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('REPEATER_ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales.');
  }
  return Buffer.from(raw, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${nonce.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Token cifrado inválido.');
  const nonce = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Token cifrado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
}
