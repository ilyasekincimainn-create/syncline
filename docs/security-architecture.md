# SyncLine Security Architecture

This document describes the design principles, cryptographic protocols, data protection, and regulatory compliance standards (KVKK & GDPR) implemented in the SyncLine platform.

---

## 1. Threat Model & Trust Assumptions

SyncLine is designed under a **Zero-Trust Infrastructure Model**. The central relay, synchronization, and auth backend services are assumed to be untrusted. An attacker who compromises the backend databases, message queue, or signaling servers must not be able to read SMS messages, call log numbers, or overhear WebRTC call conversations.

### Key Security Objectives:
- **Confidentiality**: All payload data (SMS messages, call numbers, contacts, device settings) is encrypted end-to-end.
- **Integrity**: Messages cannot be modified or replayed.
- **Privacy by Design**: No identifiable personal numbers or SMS bodies are stored in cleartext on the server.
- **Perfect Forward Secrecy**: Relayed WebRTC media uses DTLS-SRTP for transport keys generated per session.

---

## 2. Cryptographic Protocols (E2E)

### 2.1. End-to-End Encryption (AES-256-GCM)
The Android Companion and iOS client share a symmetrical key (`aes_key`) stored securely in their respective hardware-backed security modules (Android KeyStore and iOS Keychain). 

For every SMS or call event:
1. **Plaintext JSON**:
   ```json
   {
     "address": "+905551234567",
     "body": "Güvenlik kodunuz: 884721"
   }
   ```
2. **Key Parameters**:
   - Algorithm: `AES-256-GCM` (Galois/Counter Mode).
   - IV (Initialization Vector): 12-byte cryptographically secure random value generated per message.
   - Tag: 128-bit authentication tag appended to or parsed with the ciphertext.
3. **Transmission Payload**:
   The output payload uploaded to the server contains:
   - `ciphertext`: Base64 encoded payload.
   - `iv`: Base64 encoded IV.
   - `tag`: Base64 encoded auth tag.

### 2.2. Authentication (E2E DH pairing exchange)
To set up the shared secret:
1. Devices use an out-of-band authenticated pairing code.
2. The companion generates a transient Elliptic Curve Diffie-Hellman (ECDH) public-private keypair (using Curve25519).
3. The pairing code acts as a salt to generate a temporary key-encryption-key (KEK) using PBKDF2 with SHA-256.
4. The iOS device scans the QR code containing the companion's public key.
5. They perform ECDH key agreement to establish the shared symmetric AES-256-GCM key, which is saved into hardware keychains.

---

## 3. WebRTC Call Security
WebRTC media is encrypted using **DTLS-SRTP** (Datagram Transport Layer Security / Secure Real-time Transport Protocol). 
- The signaling phase uses the TLS-secured WebSocket connection to exchange SDP offers/answers and ICE candidates.
- The media packets (Opus audio) are encrypted with transient keys negotiated directly between the iOS client and the Android Companion.
- Coturn (TURN/STUN) servers only act as relays for encrypted UDP/TCP packets. Coturn does not have access to the DTLS private keys and cannot decrypt the audio.

---

## 4. KVKK & GDPR Compliance

SyncLine complies with European GDPR and Turkish KVKK regulations by design:

| Requirement | Implementation in SyncLine |
| :--- | :--- |
| **Data Minimization** | The backend database (`sync-service`) does not store plain-text phone numbers or message logs. PostgreSQL only records metadata (hashed device IDs, message timestamps). |
| **Right to Erasure** | Calling the Unpair endpoint or triggering a device deletion drops the device records, audit trails, and clean-text metadata instantly from Postgres and Redis. |
| **Data Sovereignty** | Turn and signaling servers can be deployed fully on-premise or within national borders to prevent cross-border data transfer violations. |
| **Consent & Controls** | Android Companion asks for explicit runtime permission to access SMS, Call Logs, and Phone Status, keeping the user in full control. |

---

## 5. Security Checklist & Auditing

### Penetration Testing Scenarios:
1. **Man-in-the-Middle (MITM) on Signaling**:
   - Attack: Attacker intercepts WebSocket traffic.
   - Mitigation: Traffic is protected via HTTPS/WSS. If TLS terminates, payloads are pre-encrypted with AES-256-GCM E2E. The attacker only sees random base64 strings.
2. **Server Database Dump**:
   - Attack: Attacker steals a backup of the PostgreSQL database.
   - Mitigation: The table `sms_events` only contains `ciphertext`, `iv`, `tag`, and `device_id`. Phone numbers and bodies are fully scrambled.
3. **Unauthorized Device Registering**:
   - Attack: Fake device registers on behalf of a user.
   - Mitigation: Auth service strictly enforces JWT signatures using device-specific fingerprints validated during the out-of-band pairing process.
