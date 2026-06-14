"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAES = encryptAES;
exports.decryptAES = decryptAES;
exports.generateAESKey = generateAESKey;
const crypto = __importStar(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
/**
 * Encrypt plain text using AES-256-GCM
 * @param text The text to encrypt
 * @param keyHex 32-byte key represented as hex string
 */
function encryptAES(text, keyHex) {
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
function decryptAES(encryptedData, keyHex) {
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
function generateAESKey() {
    return crypto.randomBytes(32).toString('hex');
}
//# sourceMappingURL=aes.js.map