# SyncLine API Reference & Payload Reference

This document describes the HTTP endpoints, WebSocket messages, and signaling schemas of the SyncLine microservice backend.

---

## 1. Authentication Service (`auth-service`)
Base URL: `http://localhost:3000/auth` or `http://10.0.2.2:3000/auth` (from Android emulator).

### 1.1. Register Device
* **URL**: `/register`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "deviceId": "unique-uuid-for-this-device",
    "deviceType": "android"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "accessToken": "jwt-token-string",
    "refreshToken": "refresh-token-string"
  }
  ```

### 1.2. Pairing Handshake
* **URL**: `/pair`
* **Method**: `POST`
* **Headers**:
  * `Content-Type: application/json`
  * `Authorization: Bearer <accessToken>`
* **Request Body**:
  ```json
  {
    "code": "6-digit-pairing-code"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "pairedDeviceId": "partner-device-uuid"
  }
  ```

---

## 2. Sync WebSocket Service (`sync-service`)
WS URL: `ws://localhost:3000/ws` or `ws://10.0.2.2:3000/ws`.

All messages exchanged over the WebSocket connection utilize the base JSON structure:
```json
{
  "type": "message_type",
  "id": "random_unique_message_id",
  "timestamp": 1715694200000,
  "payload": { ... }
}
```

### 2.1. Client Authentication Request (`auth_request`)
Sent immediately after opening the WebSocket connection.
```json
{
  "type": "auth_request",
  "id": "auth_req_1",
  "timestamp": 1715694200000,
  "payload": {
    "accessToken": "jwt-token-string",
    "deviceId": "my-device-uuid"
  }
}
```

### 2.2. SMS Sync Event (`sync_sms`)
Relayed from companion to backend, or from backend to iOS client.
```json
{
  "type": "sync_sms",
  "id": "sms_evt_1",
  "timestamp": 1715694250000,
  "payload": {
    "sms": [
      {
        "id": "sms_uuid_or_provider_id",
        "address": "encrypted-phone-base64",
        "body": "encrypted-message-body-base64",
        "iv": "12-byte-iv-base64",
        "timestamp": 1715694248000
      }
    ]
  }
}
```

---

## 3. Relay WebSocket Service (`relay-service`)
WS URL: `ws://localhost:3000/relay` or `ws://10.0.2.2:3000/relay`.

Used for real-time WebRTC SDP exchanges. Refer to [webrtc-bridge.md](file:///c:/Users/ilyas/OneDrive/Desktop/Antigravity/projeler/imei%20tel/docs/webrtc-bridge.md) for sequence details and payloads.
- Types: `register_relay`, `sdp_offer`, `sdp_answer`, `ice_candidate`.
