# WebRTC Audio Bridge & Signaling Protocol

This document details the signaling protocol, ICE candidate negotiation flow, and error states for the SyncLine low-latency voice bridge between the Android Companion (SIM) and the iOS Client (No SIM).

---

## 1. Interaction Flow

```mermaid
sequenceDiagram
    autonumber
    participant iOS as iOS Client (No SIM)
    participant Relay as Relay Service (Signaling)
    participant Companion as Android Companion (SIM)
    
    Note over iOS, Companion: WebRTC Signaling Handshake
    iOS->>Relay: WS: register_relay (deviceId, token)
    Companion->>Relay: WS: register_relay (deviceId, token)
    
    Note over iOS, Companion: Incoming VoIP Push Trigger
    Companion-->>Relay: Detected Call (Starts WebRTC)
    Relay-->>iOS: APNs VoIP Push (callId, caller)
    
    iOS->>Relay: WS: ice_candidate (local ICE)
    Companion->>Relay: WS: ice_candidate (local ICE)
    
    iOS->>Relay: WS: sdp_offer (SDP description)
    Relay->>Companion: Relayed Offer
    Companion->>Companion: Set Remote SDP & Init Audio
    Companion->>Relay: WS: sdp_answer (SDP description)
    Relay->>iOS: Relayed Answer
    iOS->>iOS: Set Remote SDP
    
    Note over iOS, Companion: ICE Negotiation & P2P Stream
    Relay->>Companion: Relayed ICE candidate
    Relay->>iOS: Relayed ICE candidate
    iOS<->Companion: P2P Audio Connection established (DTLS-SRTP)
```

---

## 2. Signaling Message Schemas

Signaling payloads are JSON packets sent via WebSocket connections to `relay-service`.

### 2.1. SDP Offer / Answer Payload
```json
{
  "type": "sdp_offer",
  "id": "msg_offer_17156942",
  "timestamp": 1715694200000,
  "payload": {
    "targetId": "companion_android_device_id",
    "callId": "call_unique_uuid",
    "sdp": "v=0\r\no=- 802315... (Standard SDP offer string)"
  }
}
```

### 2.2. ICE Candidate Payload
```json
{
  "type": "ice_candidate",
  "id": "msg_ice_17156943",
  "timestamp": 1715694300000,
  "payload": {
    "targetId": "ios_device_id",
    "callId": "call_unique_uuid",
    "candidate": "candidate:842163046 1 udp 1686052607 192.168.1.150 54101 typ host ...",
    "sdpMid": "audio",
    "sdpMLineIndex": 0
  }
}
```

---

## 3. ICE Negotiation States

1. **New / Checking**: Gathering local candidates (Host, Server Reflexive - STUN, Relay - TURN).
2. **Connected / Completed**: A viable path was verified; DTLS handshake completes, audio starts.
3. **Failed**: Cannot establish peer connection. Falls back to sync service offline logging or notification retries.

### OEM Turn Server (Coturn) Details:
- SyncLine uses `coturn` configured with time-limited REST API credentials.
- The backend generates temporary credentials using the shared secret configured in `turnserver.conf`:
  - Username: `timestamp:userId`
  - Password: `HMAC-SHA1(secret, username)`
- Coturn uses UDP port `3478` for STUN/TURN, and port `5349` for secure TLS connections.
