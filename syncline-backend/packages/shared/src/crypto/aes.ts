import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

/**
 * Encrypt plain text using AES-256-GCM
 * @param text The text to encrypt
 * @param keyHex 32-byte key represented as hex string
 */
export function encryptAES(text: string, keyHex: string): EncryptedData {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be a 32-byte hex string (64 characters)');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(text, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    ciphertext: ciphertext + tag,
    iv: iv.toString('hex')
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param encryptedData Encrypted content containing ciphertext and IV
 * @param keyHex 32-byte key represented as hex string
 */
export function decryptAES(encryptedData: EncryptedData, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Decryption key must be a 32-byte hex string (64 characters)');
  }
  
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const fullCiphertext = Buffer.from(encryptedData.ciphertext, 'hex');
  
  // Extract tag from the end
  const tagPos = fullCiphertext.length - TAG_LENGTH;
  const ciphertext = fullCiphertext.subarray(0, tagPos);
  const tag = fullCiphertext.subarray(tagPos);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generates a random 256-bit key formatted as a hex string
 */
export function generateAESKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
