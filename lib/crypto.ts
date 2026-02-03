import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CBC.
 * Expects ENCRYPTION_KEY in .env (32 bytes / 64 hex chars).
 */
export function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    console.warn('[crypto] ENCRYPTION_KEY is missing or too short. Returning plain text.');
    return text;
  }

  // Ensure key is exactly 32 bytes
  const secretKey = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string. If decryption fails or text is not encrypted, returns original.
 */
export function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) return text;

  try {
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const secretKey = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error(`[notifications] Decryption failed for sensitive field. This usually happens if the record was saved with a different ENCRYPTION_KEY or in plain text.`);
    // If it's not a valid encrypted string, return as-is
    return text;
  }
}
