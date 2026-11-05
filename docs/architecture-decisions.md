# StudySync Architecture Decision Record (ADR)
## Real-Time Collaboration & Communication Architecture (Google Meet & WhatsApp Paradigms)

**Author:** Antigravity Architecture & Real-Time Engineering Team  
**Date:** November 2026  
**Status:** Approved & Implemented  
**Scope:** StudySync Video/Audio Rooms, Persistent In-App Calling, Live Collaboration, WhatsApp-Grade Messaging, Security, and CI/CD Pipeline.

---

## 1. Executive Summary

StudySync is an academic collaboration application designed for students. The core product experience centers on:
1. **Student Identity & Discovery:** Cryptographically verified student identity, unique alphanumeric Student IDs (`STU-XXXXXX`), and direct discovery.
2. **Private Messaging & Private Study Groups:** WhatsApp-grade messaging reliability with persistent SQLite message store, real-time Socket.IO synchronization, unread counters, delivery tracking, and strict privacy boundaries.
3. **Private Collaborative Study Rooms:** Google Meet-grade real-time audio/video collaboration, screen sharing, live whiteboard synchronization, hardware-accurate camera/microphone lifecycles, and a persistent application-level meeting session that seamlessly survives route navigation with floating mini-window and Picture-in-Picture (PiP) support.

This document details the architectural findings from Google Meet and WhatsApp, documents the design decisions tailored for StudySync, and specifies the technical implementation plan.

---

## 2. Research: Google Meet Real-Time Media Architecture

### 2.1 Signaling & Session Establishment
- **WebRTC Peer Connection Lifecycle:** A WebRTC session requires an exchange of session descriptions (SDP offers and answers) and Interactive Connectivity Establishment (ICE) candidates before real-time media flows.
- **Signaling Channel:** WebRTC does not specify a signaling protocol. Google Meet uses an internal high-availability signaling service over WebSocket/QUIC. For StudySync, Socket.IO provides the bidirectional, event-driven signaling channel with low latency and automatic reconnection.
- **ICE Candidate Trickling:** Google Meet trickles ICE candidates asynchronously rather than waiting for candidate gathering to finish. StudySync adopts trickle ICE to minimize connection establishment delay.

### 2.2 STUN, TURN, and NAT Traversal
- **STUN (Session Traversal Utilities for NAT):** STUN servers allow peers to discover their public-facing IP addresses and port mappings (reflexive candidates). STUN works for Full Cone, Restricted Cone, and Port-Restricted Cone NATs.
- **TURN (Traversal Using Relays around NAT):** For Symmetric NATs or strict university/enterprise firewalls (common in campus Wi-Fi networks and dormitories), direct P2P connections fail. Google Meet deploys globally distributed TURN relay clusters. StudySync's production roadmap requires TURN servers (e.g. Coturn or hosted TURN) configured in `RTCConfiguration.iceServers` with credential expiration.

### 2.3 Media Routing Topology: Mesh vs. SFU
- **Full Mesh (P2P):** Each participant establishes an `RTCPeerConnection` with every other participant.
  - *Bandwidth Complexity:* $O(N)$ upload streams and $O(N)$ download streams per client, or $O(N^2)$ overall bandwidth consumption.
  - *Viability:* Excellent for 2 to 4 participants (peer-to-peer latency, zero intermediate media server cost, end-to-end encryption by default). However, CPU and upstream network saturate as participant count exceeds 4–6.
- **Selective Forwarding Unit (SFU):** Participants send 1 media stream upstream to a central server (e.g. LiveKit, mediasoup, Janus); the SFU selectively routes and forwards individual streams to all subscribers without decoding or transcoding.
  - *Bandwidth Complexity:* 1 upstream, $N-1$ downstreams per participant.
  - *Viability:* Required for larger rooms (5 to 100+ participants).
- **StudySync Decision:**
  - StudySync targets small, private student study groups (typically 2 to 6 students per private room).
  - An optimized, robust Full Mesh architecture with polite/impolite WebRTC collision handling, proper transceiver management, and ICE candidate buffering is the ideal zero-overhead solution for the current product footprint.
  - For larger institution-wide lecture rooms (10+ students), the architecture document details the migration path to an SFU (e.g., LiveKit).

### 2.4 Device & Track Lifecycle Management
- **Hardware Indicator Accuracy:** A common failure mode in WebRTC applications is setting `track.enabled = false` instead of invoking `track.stop()`.
  - Setting `track.enabled = false` continues capturing black frames from hardware; the webcam hardware light remains illuminated, eroding user trust.
  - **The Google Meet Standard:** When camera or microphone is turned OFF, the underlying `MediaStreamTrack` must be permanently stopped (`track.stop()`), the local preview unbound, and the WebRTC sender updated (`sender.replaceTrack(null)` or transceiver direction set). When turned back ON, a fresh `getUserMedia` call obtains a new track and swaps it into the existing sender via `replaceTrack()`.
  - **Reload Behavior:** Meeting entry must NEVER auto-activate camera or microphone without explicit user consent or remembered user choice. StudySync initializes rooms with hardware muted by default upon browser reload.

### 2.5 Audio Processing & Constraints
- Browser WebRTC stacks natively implement:
  - `echoCancellation: true`: Acoustic Echo Cancellation (AEC) cancels speaker audio fed back into the mic.
  - `noiseSuppression: true`: Spectral subtraction / Wiener filtering cleans background fan and keyboard noise.
  - `autoGainControl: true`: Dynamic audio volume normalization.
- Advanced AI noise cancellation (e.g. Google Meet Krisp-like models) operates as an audio Worklet / WebAssembly DSP module. StudySync leverages standard browser-certified media constraints, with fallbacks for unsupported browsers.

### 2.6 Background Meeting Persistence & Route Navigation
- **The Problem:** In standard single-page React applications, mounting a video component inside a route (e.g. `/rooms/:id`) causes the component to unmount when the user navigates to `/dashboard` or `/messages`, severing the WebSocket connection, closing `RTCPeerConnection`s, and stopping hardware tracks.
- **The Google Meet Pattern:** The meeting session lifecycle is managed at the root application layer (Global Context/State Provider). Route changes merely alter the presentation mode:
  - Inside `/rooms/:id`: Full-screen collaborative view with whiteboard, participants, and chat.
  - Outside `/rooms/:id`: Minimized floating PiP mini-window containing remote video, audio controls, active screen-share indicator, and a one-click restore button.
  - Termination occurs ONLY on explicit user exit, host termination, or server session revocation.

---

## 3. Research: WhatsApp Messaging Architecture

### 3.1 Persistence, Delivery Guarantees & Idempotency
- **Persistent Message Store:** WhatsApp stores messages locally on device and persistently on central message brokers until delivered. StudySync uses SQLite with WAL (Write-Ahead Logging) mode and foreign key cascades.
- **End-to-End Delivery Flow:**
  1. *Optimistic Client Rendering:* The message is immediately rendered with a clock/pending status indicator.
  2. *Server Ingestion & Persistence:* The HTTP/REST API validates session identity, stores the message transactionally, and returns the persisted record with server timestamp and UUID.
  3. *Real-Time Relay:* The backend emits the event to the recipient's personal socket room (`user:<userId>`) or group socket room (`group:<groupId>`).
  4. *Recipient Acknowledgment:* When the recipient is online and active in the conversation, the message status is updated to read (`is_read = 1`), and a read receipt is sent back.
  5. *Offline Catch-up:* When an offline user connects or opens a conversation, the backend queries messages since the last acknowledged timestamp.

### 3.2 Authorization & Membership Validation
- A user cannot emit a socket message to a group room unless they are an active, verified member of that group in the database.
- Direct messages can only be sent between registered, active student accounts.
- Client-provided user IDs are discarded; all database insertions strictly derive `sender_id` from the authenticated JWT session.

---

## 4. Architectural Decisions for StudySync

| Domain | StudySync Implementation | Justification |
| :--- | :--- | :--- |
| **Media Topology** | Polished Full Mesh WebRTC (2-6 peers) | Lightweight, zero external infrastructure costs, private, peer-to-peer encrypted. |
| **Signaling** | Socket.IO with JWT Handshake Auth | Low-latency bi-directional event transport, room isolation, automatic reconnection. |
| **Meeting Persistence** | Application-Level `MeetingContext` | Keeps peer connections, media tracks, and socket rooms alive across SPA page routing. |
| **Meeting External PiP** | W3C Document Picture-in-Picture API + Dock Fallback | True floating desktop window for study rooms with active streams and controls. |
| **Hardware Lifecycle** | Full `track.stop()` & `replaceTrack(null)` | Laptop hardware camera/mic LEDs turn off cleanly when disabled; reload stays OFF. |
| **Screen Sharing** | `navigator.mediaDevices.getDisplayMedia` + Room Broadcast | Broadcasts presentation state, animates buttons, syncs on peer rejoin. |
| **Whiteboard Sync** | Delta socket broadcasts + Server Canvas Snapshot | Lightweight real-time vector strokes with catch-up sync for new joiners. |
| **Password Reset** | 6-Digit Cryptographic OTP + Ephemeral Auth Token | Replaces insecure link tokens with rate-limited, single-use, hash-stored OTPs. |
| **Messaging** | Transactional SQLite + Socket Push + Unread Counts | High reliability, zero message loss, offline catch-up, WhatsApp-like UX. |
| **CI/CD Pipeline** | Declarative Jenkinsfile + Vitest + Docker Deployment | Automated linting, deep testing, zero-downtime container replacement, and rollback. |

---

## 5. External StudySync Meeting Picture-in-Picture (PiP) Architecture

### 6.1 W3C Document Picture-in-Picture API
- **The Standard:** Uses `window.documentPictureInPicture.requestWindow({ width, height })` available in modern Chromium browsers.
- **Full Interactive Meeting Capability:** Unlike standard `<video>` PiP (which only projects a single mute video element with no buttons), Document PiP opens an external OS-level floating window hosting full React interactive controls:
  - Room name and invite code.
  - Live connection status badge.
  - Participant count counter.
  - Active video stream (screen share, active speaker, remote peer, or local preview).
  - Microphone toggle (Mic on / Mic muted).
  - Camera toggle (Cam on / Cam off).
  - "Restore Full Meeting" action (focuses main window and returns to `/rooms/:id`).
  - "Leave Room" action (hangs up, cleans up presence, and closes window).

### 6.2 Session Preservation & WebRTC Continuity
- **Zero Disconnection Guarantee:** The active meeting is owned by `MeetingContext` at the root application layer.
- **Zero Reacquisition Overhead:** When Document PiP opens or closes:
  - Local microphone and camera tracks are NOT stopped or reacquired.
  - WebRTC peer connections and transceivers remain connected without ICE restarts.
  - Socket.IO subscriptions and room presence stay active.
  - The existing `MediaStream` is simply attached to the `<video>` element inside the PiP window.

### 6.3 Lifecycle Transitions & Fallbacks
- **Browser Capability Matrix:**
  - *Chromium (Chrome 116+, Edge 116+, Opera):* Full external Document PiP window supported.
  - *Firefox & Safari:* External Document PiP not yet implemented by browser vendors.
- **Graceful Fallback:**
  - Runtime detection via `'documentPictureInPicture' in window`.
  - On unsupported browsers, clicking "Minimize to PiP" automatically switches the meeting to the in-app floating dock and displays a helpful toast.
  - Standard HTMLVideoElement PiP remains available as a secondary video-only fallback.
- **Pagehide / Window Closure:**
  - When the student clicks the standard OS 'X' on the external PiP window, a `pagehide` listener captures the event and returns the meeting to the in-app floating dock without disconnecting the call.

---

## 6. Migration and Production Infrastructure

1. **STUN/TURN Servers:**
   - Development uses Google's public STUN servers (`stun.l.google.com:19302`).
   - Production deployment requires deploying Coturn or configuring a managed TURN provider (e.g. Twilio or Cloudflare Calls) to traverse symmetric NATs and restrictive firewalls.
2. **SFU Evolution Path:**
   - When rooms exceed 6 concurrent video publishers, StudySync can transition room routing to LiveKit or mediasoup SFU without altering the frontend `MeetingContext` API contracts.
3. **Database Scalability:**
   - SQLite WAL mode easily handles thousands of daily active student transactions on a single modern VPS with low read/write latency.
   - Database files (`studysync.db*`) and uploads (`/uploads`) are mounted as persistent Docker volumes.
---

## 7. Persistent Application-Level Floating Meeting Window & Top-Level Stacking Context

### 7.1 Problem Statement
Browser-level Document Picture-in-Picture creates external OS windows that lose focus and move behind the main browser application when the student clicks elsewhere in StudySync (e.g. interacting with Dashboard, Chats, Profile, or Settings). In addition, within single-page application component trees, nested elements with `position: fixed` and high `z-index` can be trapped within local stacking contexts created by parent CSS `transform`, `filter`, `perspective`, `backdrop-filter`, or `isolation: isolate`.

### 7.2 Architectural Solution
1. **Dedicated Top-Level Stacking Context (`#studysync-floating-overlay-root`):**
   - The floating meeting dock is mounted outside the React application root (`#root`) via a dedicated portal into `#studysync-floating-overlay-root`, direct child of `<body>`.
   - The overlay container is positioned with `position: fixed; inset: 0; pointer-events: none; z-index: 10000; overflow: hidden;`.
   - The meeting dock itself uses `pointer-events: auto; position: fixed;`.
   - This ensures all pointer events outside the dock pass through cleanly to page content (cards, forms, chats, buttons), while interactions with the dock (dragging, muting, camera, resizing, expanding, leaving) are captured without obstruction.

2. **Global Application Stacking Context Hierarchy:**
   - **Base Page & Workspace:** `z-index: 0 – 100` (cards, tables, buttons)
   - **Sticky Top Bar:** `z-index: 40`
   - **Profile Dropdown:** `z-index: 100`
   - **Mobile Sticky Bottom Navigation:** `z-index: 200`
   - **Desktop Left Floating Navigation Rail:** `z-index: 300`
   - **Floating Action Buttons:** `z-index: 500`
   - **Mobile Drawer Backdrop / Panel:** `z-index: 998 / 999`
   - **Application Modals & Dialogs (`#studysync-modal-root`):** `z-index: 1000`
   - **Toast Notifications Container:** `z-index: 2000`
   - **Persistent Floating Meeting Dock Overlay:** `z-index: 10000`
   - **Spark Visual Micro-Effects:** `z-index: 99999`

3. **Draggable & Responsive Viewport Boundary Clamping:**
   - Supports mouse and single-touch dragging from the header grip.
   - Clamped within viewport boundaries (`minX: 16px`, `maxX: winW - width - 16px`, `minY: 16px`, `maxY: winH - height - 16px` on desktop).
   - On mobile screens ($\le 768\text{px}$), strictly clamps `maxY` to `winH - height - 68px` to guarantee the floating dock never obscures the mobile sticky bottom navigation rail.
   - Listens to window resize events and automatically reclamps to prevent off-screen stranding.

4. **Dock Modes & Resizing:**
   - **Normal Preview Mode:** $340\times 245\text{px}$ video preview with presenter badges, participant count, and controls.
   - **Compact Preview Mode:** $260\times 185\text{px}$.
   - **Expanded Preview Mode:** $440\times 320\text{px}$.
   - **Collapsed Pill Bar:** $260\times 48\text{px}$ minimal horizontal status bar with active pulse, room title, participant count, and quick controls.
   - Closing or collapsing the dock never leaves the meeting; only explicit "Leave Room" calls terminate the WebRTC session.

