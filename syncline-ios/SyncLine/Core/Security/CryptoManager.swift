import Foundation
import CryptoKit

class CryptoManager {
    
    static let shared = CryptoManager()
    
    // Symmetric encryption key generated on first setup or shared during pairing
    private var encryptionKey: SymmetricKey?
    
    private init() {
        loadOrGenerateKey()
    }
    
    private func loadOrGenerateKey() {
        if let keyBase64 = KeychainHelper.shared.read(service: "syncline", account: "symmetric_key"),
           let keyData = Data(base64Encoded: keyBase64) {
            encryptionKey = SymmetricKey(data: keyData)
        } else {
            // Generate a fresh 256-bit symmetric key
            let key = SymmetricKey(size: .bits256)
            let keyData = key.withUnsafeBytes { Data($0) }
            let keyBase64 = keyData.base64EncodedString()
            KeychainHelper.shared.save(keyBase64, service: "syncline", account: "symmetric_key")
            encryptionKey = key
        }
    }
    
    func setSymmetricKey(_ keyBase64: String) {
        if let keyData = Data(base64Encoded: keyBase64) {
            KeychainHelper.shared.save(keyBase64, service: "syncline", account: "symmetric_key")
            encryptionKey = SymmetricKey(data: keyData)
        }
    }
    
    func encrypt(_ text: String) -> (ciphertext: String, iv: String)? {
        guard let key = encryptionKey,
              let data = text.data(using: .utf8) else {
            return nil
        }
        
        do {
            let sealedBox = try AES.GCM.seal(data, using: key)
            let ciphertext = sealedBox.ciphertext.base64EncodedString()
            let iv = sealedBox.nonce.withUnsafeBytes { Data($0).base64EncodedString() }
            return (ciphertext, iv)
        } catch {
            print("Encryption failed: \(error)")
            return nil
        }
    }
    
    func decrypt(ciphertextBase64: String, ivBase64: String) -> String? {
        guard let key = encryptionKey,
              let ciphertext = Data(base64Encoded: ciphertextBase64),
              let ivData = Data(base64Encoded: ivBase64) else {
            return nil
        }
        
        do {
            let nonce = try AES.GCM.Nonce(data: ivData)
            // Combine tag at the end (CryptoKit GCM expects sealed box with ciphertext, tag, and nonce)
            // But if tag is separate, we can build a sealed box using nonce, ciphertext, and tag.
            // In our system, the Android Keystore output concatenates ciphertext + tag.
            // Let's check how Android Keystore works. In our Android CryptoManager, we do:
            // val ciphertext = cipher.doFinal(bytes)
            // In Java AES/GCM, cipher.doFinal returns [ciphertext + 16-byte authentication tag].
            // So ciphertextBase64 actually contains both ciphertext and tag!
            // iOS CryptoKit allows creating a sealed box directly from combined data:
            // let sealedBox = try AES.GCM.SealedBox(combined: nonce + ciphertext + tag)
            // Or we can split it.
            // Let's implement the combined box:
            let tagLength = 16
            guard ciphertext.count > tagLength else { return nil }
            
            let tagPos = ciphertext.count - tagLength
            let ciphertextOnly = ciphertext.subdata(in: 0..<tagPos)
            let tag = ciphertext.subdata(in: tagPos..<ciphertext.count)
            
            let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertextOnly, tag: tag)
            let decryptedData = try AES.GCM.open(sealedBox, using: key)
            
            return String(data: decryptedData, encoding: .utf8)
        } catch {
            print("Decryption failed: \(error)")
            return nil
        }
    }
}
