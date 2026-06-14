export interface EncryptedData {
    ciphertext: string;
    iv: string;
}
/**
 * Encrypt plain text using AES-256-GCM
 * @param text The text to encrypt
 * @param keyHex 32-byte key represented as hex string
 */
export declare function encryptAES(text: string, keyHex: string): EncryptedData;
/**
 * Decrypt ciphertext using AES-256-GCM
 * @param encryptedData Encrypted content containing ciphertext and IV
 * @param keyHex 32-byte key represented as hex string
 */
export declare function decryptAES(encryptedData: EncryptedData, keyHex: string): string;
/**
 * Generates a random 256-bit key formatted as a hex string
 */
export declare function generateAESKey(): string;
//# sourceMappingURL=aes.d.ts.map