# SyncLine MVP Sprint Plan & Backlog

This document defines the 8-week MVP roadmap, task tables, risk registers, and future backlog items for the SyncLine multi-platform platform.

---

## 1. 8-Week MVP Sprint Schedule

| Sprint | Goal | Key Deliverables |
| :--- | :--- | :--- |
| **Sprint 1** | Foundation & Shared Core | Monorepo setup, Shared TypeScript package, DB Migrations, Kotlin/Swift crypto helpers. |
| **Sprint 2** | Auth & Device Registration | Auth microservice (Fastify), PostgreSQL schema activation, Pairing QR generator on Android, scan & match on iOS. |
| **Sprint 3** | Foreground Listeners | Android SMS receiver, Call state broadcasts, local Room db storage, APNs integrations. |
| **Sprint 4** | WebSocket Sync Core | Fastify WebSocket sync service, Redis Streams queuing, iOS WebSocket client. |
| **Sprint 5** | WebRTC signaling | Fastify Relay signaling, Coturn integrations, WebRTC Kotlin binding on Android. |
| **Sprint 6** | CallKit & iOS UI | iOS PushKit voip handler, CallKit manager, WebRTC client integration, SwiftUI Main view. |
| **Sprint 7** | Hardening & E2E Crypto | AES-256-GCM verification, background battery bypass configurations, battery tests. |
| **Sprint 8** | QA & Rollout | Load testing with k6, deployment docs, production IPA/APK build runs. |

---

## 2. Risk Register & Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Aggressive OEM Task Killers** | High | Critical | Implement foreground service with `specialUse` tags, wake locks, Wi-Fi locks, auto-start configurations, and user guide. |
| **APNs / FCM Token Expirations** | Medium | High | Re-fetch and update token on client launch and save to postgres via device endpoint. |
| **CallKit Call reporting limits (10s)** | Low | Critical | PushKit callback instantly triggers CallKit before resolving signaling or decryption keys. |
| **WebRTC symmetric NAT blockages** | Medium | High | Deploy dedicated Coturn instance with port 443 TURN-over-TLS fallback. |

---

## 3. Backlog for v2.0

- **Dual-SIM Support**: Fully routing individual SMS and calls to dedicated SIM slots on Android.
- **Media Messaging (MMS)**: Forwarding attachments, photos, and voice memos.
- **Web App / Desktop Client**: Extending the bridge to a desktop Nuri web platform.
- **Shared Device Mode**: Pairing a companion device with multiple iOS client nodes concurrently.
