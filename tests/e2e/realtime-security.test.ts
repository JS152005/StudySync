import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app, server } from '../../server/src/index.js';
import { db, generateStudentId, generateRoomInviteCode } from '../../server/src/db/index.js';
import { config } from '../../server/src/config/index.js';

describe('Real-Time Security Layer & Chat Robustness Verification Suite', () => {
  let serverPort = 0;
  let serverUrl = '';

  let hostUser: { id: string; username: string; fullName: string; studentId: string; token: string };
  let memberUser: { id: string; username: string; fullName: string; studentId: string; token: string };
  let strangerUser: { id: string; username: string; fullName: string; studentId: string; token: string };
  let deactivatedUser: { id: string; token: string };
  let unverifiedUser: { id: string; token: string };

  let testRoomId = '';
  let secondRoomId = '';
  let testGroupId = '';

  const activeSockets: ClientSocketType[] = [];

  function connectSocket(opts: { token?: string; cookie?: string } = {}): Promise<ClientSocketType> {
    return new Promise((resolve, reject) => {
      const extraHeaders: Record<string, string> = {};
      if (opts.cookie) {
        extraHeaders.cookie = opts.cookie;
      }
      const sock = ClientSocket(serverUrl, {
        auth: opts.token !== undefined ? { token: opts.token } : undefined,
        extraHeaders,
        transports: ['websocket'],
        reconnection: false,
        timeout: 2500,
      });

      activeSockets.push(sock);

      sock.on('connect', () => {
        resolve(sock);
      });

      sock.on('connect_error', (err) => {
        resolve(sock); // Resolve with sock so error can be checked or rejected
      });
    });
  }

  beforeAll(async () => {
    // 1. Start test server on ephemeral port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          serverPort = addr.port;
          serverUrl = `http://localhost:${serverPort}`;
        }
        resolve();
      });
    });

    const now = new Date().toISOString();
    const hash = '$2a$12$e80yq9c6560KfZg7pYkZ0uRk7gPj.C00HkO7jY56.66f0Z9zFkXkG';

    // 2. Create Host User
    const hostId = crypto.randomUUID();
    const hostStudentId = generateStudentId();
    const hostUsername = `sec_host_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Prof. Security Host', ?, 1, 1, ?, ?)
    `).run(hostId, hostStudentId, `${hostUsername}@example.com`, hostUsername, hash, now, now);
    const hostToken = jwt.sign({ userId: hostId }, config.jwtSecret, { expiresIn: '1d' });
    hostUser = { id: hostId, username: hostUsername, fullName: 'Prof. Security Host', studentId: hostStudentId, token: hostToken };

    // 3. Create Group Member User
    const memberId = crypto.randomUUID();
    const memberStudentId = generateStudentId();
    const memberUsername = `sec_member_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Verified Member', ?, 1, 1, ?, ?)
    `).run(memberId, memberStudentId, `${memberUsername}@example.com`, memberUsername, hash, now, now);
    const memberToken = jwt.sign({ userId: memberId }, config.jwtSecret, { expiresIn: '1d' });
    memberUser = { id: memberId, username: memberUsername, fullName: 'Verified Member', studentId: memberStudentId, token: memberToken };

    // 4. Create Stranger User
    const strangerId = crypto.randomUUID();
    const strangerStudentId = generateStudentId();
    const strangerUsername = `sec_stranger_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Uninvited Stranger', ?, 1, 1, ?, ?)
    `).run(strangerId, strangerStudentId, `${strangerUsername}@example.com`, strangerUsername, hash, now, now);
    const strangerToken = jwt.sign({ userId: strangerId }, config.jwtSecret, { expiresIn: '1d' });
    strangerUser = { id: strangerId, username: strangerUsername, fullName: 'Uninvited Stranger', studentId: strangerStudentId, token: strangerToken };

    // 5. Create Deactivated User
    const deactId = crypto.randomUUID();
    const deactUsername = `deact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Deactivated Account', ?, 1, 0, ?, ?)
    `).run(deactId, generateStudentId(), `${deactUsername}@example.com`, deactUsername, hash, now, now);
    deactivatedUser = { id: deactId, token: jwt.sign({ userId: deactId }, config.jwtSecret) };

    // 6. Create Unverified User
    const unverId = crypto.randomUUID();
    const unverUsername = `unver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO users (id, student_id, email, username, full_name, password_hash, is_verified, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unverified Account', ?, 0, 1, ?, ?)
    `).run(unverId, generateStudentId(), `${unverUsername}@example.com`, unverUsername, hash, now, now);
    unverifiedUser = { id: unverId, token: jwt.sign({ userId: unverId }, config.jwtSecret) };

    // 7. Create Study Group
    testGroupId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO study_groups (id, name, description, is_private, created_by, created_at, updated_at)
      VALUES (?, 'Algorithms Research Group', 'Security testing group', 1, ?, ?, ?)
    `).run(testGroupId, hostId, now, now);

    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
      VALUES (?, ?, ?, 'owner', 'active', ?)
    `).run(crypto.randomUUID(), testGroupId, hostId, now);

    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
      VALUES (?, ?, ?, 'member', 'active', ?)
    `).run(crypto.randomUUID(), testGroupId, memberId, now);

    // 8. Create Primary Test Room attached to group
    testRoomId = crypto.randomUUID();
    const code1 = generateRoomInviteCode();
    db.prepare(`
      INSERT INTO study_rooms (id, name, subject, topic, group_id, host_id, invite_code, is_active, created_at)
      VALUES (?, 'Room Alpha', 'CS', 'Security', ?, ?, ?, 1, ?)
    `).run(testRoomId, testGroupId, hostId, code1, now);

    db.prepare(`
      INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at)
      VALUES (?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), testRoomId, hostId, now);

    // 9. Create Second Test Room for cross-room signaling tests
    secondRoomId = crypto.randomUUID();
    const code2 = generateRoomInviteCode();
    db.prepare(`
      INSERT INTO study_rooms (id, name, subject, topic, host_id, invite_code, is_active, created_at)
      VALUES (?, 'Room Beta', 'Math', 'Calculus', ?, ?, 1, ?)
    `).run(secondRoomId, strangerId, code2, now);

    db.prepare(`
      INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at)
      VALUES (?, ?, ?, 0, 0, ?)
    `).run(crypto.randomUUID(), secondRoomId, strangerId, now);
  });

  afterAll(async () => {
    for (const sock of activeSockets) {
      if (sock && sock.connected) {
        sock.disconnect();
      }
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('1. Socket Authentication Middleware Enforcement', () => {
    it('Rejects connection when no authentication token is provided', async () => {
      let connectErrorReceived: string | null = null;
      const sock = ClientSocket(serverUrl, {
        auth: {},
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect_error', (err) => {
          connectErrorReceived = err.message;
          resolve();
        });
        sock.on('connect', () => {
          resolve();
        });
      });

      expect(connectErrorReceived).toBe('unauthorized');
      expect(sock.connected).toBe(false);
    });

    it('Rejects connection when invalid JWT token is supplied', async () => {
      let connectErrorReceived: string | null = null;
      const sock = ClientSocket(serverUrl, {
        auth: { token: 'invalid.tampered.token' },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect_error', (err) => {
          connectErrorReceived = err.message;
          resolve();
        });
        sock.on('connect', () => {
          resolve();
        });
      });

      expect(connectErrorReceived).toBe('unauthorized');
      expect(sock.connected).toBe(false);
    });

    it('Rejects connection when account is deactivated (is_active = 0)', async () => {
      let connectErrorReceived: string | null = null;
      const sock = ClientSocket(serverUrl, {
        auth: { token: deactivatedUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect_error', (err) => {
          connectErrorReceived = err.message;
          resolve();
        });
        sock.on('connect', () => {
          resolve();
        });
      });

      expect(connectErrorReceived).toBe('unauthorized');
      expect(sock.connected).toBe(false);
    });

    it('Rejects connection when account is unverified (is_verified = 0)', async () => {
      let connectErrorReceived: string | null = null;
      const sock = ClientSocket(serverUrl, {
        auth: { token: unverifiedUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect_error', (err) => {
          connectErrorReceived = err.message;
          resolve();
        });
        sock.on('connect', () => {
          resolve();
        });
      });

      expect(connectErrorReceived).toBe('unauthorized');
      expect(sock.connected).toBe(false);
    });

    it('Accepts connection when valid JWT is passed via auth.token', async () => {
      const sock = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect', () => resolve());
      });

      expect(sock.connected).toBe(true);
    });

    it('Accepts connection when valid JWT is passed via HttpOnly cookie header', async () => {
      const sock = ClientSocket(serverUrl, {
        extraHeaders: {
          cookie: `token=${memberUser.token}; other=value`,
        },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sock);

      await new Promise<void>((resolve) => {
        sock.on('connect', () => resolve());
      });

      expect(sock.connected).toBe(true);
    });
  });

  describe('2. Room Authorization & Scoping', () => {
    it('Blocks non-member from joining study room via join_study_room', async () => {
      const strangerSock = ClientSocket(serverUrl, {
        auth: { token: strangerUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(strangerSock);

      await new Promise<void>((resolve) => strangerSock.on('connect', () => resolve()));

      const errorPromise = new Promise<any>((resolve) => {
        strangerSock.on('room_error', (data) => resolve(data));
      });

      strangerSock.emit('join_study_room', { roomId: testRoomId });

      const err = await errorPromise;
      expect(err.error).toMatch(/Unauthorized/i);
    });

    it('Allows authorized group member to join study room', async () => {
      const hostSock = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(hostSock);
      await new Promise<void>((resolve) => hostSock.on('connect', () => resolve()));
      hostSock.emit('join_study_room', { roomId: testRoomId });

      const memberSock = ClientSocket(serverUrl, {
        auth: { token: memberUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(memberSock);
      await new Promise<void>((resolve) => memberSock.on('connect', () => resolve()));

      const peerJoinedPromise = new Promise<any>((resolve) => {
        hostSock.once('peer_joined', (data) => resolve(data));
      });

      const existingPeersPromise = new Promise<any>((resolve) => {
        memberSock.once('existing_peers', (data) => resolve(data));
      });

      memberSock.emit('join_study_room', { roomId: testRoomId });

      const [peerJoined, existingPeers] = await Promise.all([peerJoinedPromise, existingPeersPromise]);
      expect(peerJoined.userId).toBe(memberUser.id);
      expect(existingPeers.peers.some((p: any) => p.userId === hostUser.id)).toBe(true);
    });
  });

  describe('3. Group Chat Authorization', () => {
    it('Non-member cannot join a group chat via join_group_chat', async () => {
      const strangerSock = ClientSocket(serverUrl, {
        auth: { token: strangerUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(strangerSock);
      await new Promise<void>((resolve) => strangerSock.on('connect', () => resolve()));

      const chatErrorPromise = new Promise<any>((resolve) => {
        strangerSock.once('chat_error', (data) => resolve(data));
      });

      strangerSock.emit('join_group_chat', { groupId: testGroupId });

      const err = await chatErrorPromise;
      expect(err.error).toMatch(/not an active member/i);
    });

    it('Active group member can join group chat', async () => {
      const memberSock = ClientSocket(serverUrl, {
        auth: { token: memberUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(memberSock);
      await new Promise<void>((resolve) => memberSock.on('connect', () => resolve()));

      let errorFired = false;
      memberSock.once('chat_error', () => {
        errorFired = true;
      });

      memberSock.emit('join_group_chat', { groupId: testGroupId });
      await new Promise((r) => setTimeout(r, 100));

      expect(errorFired).toBe(false);
    });
  });

  describe('4. Cross-Room WebRTC Signaling & Event Scoping', () => {
    it('Blocks WebRTC signaling between sockets in different rooms', async () => {
      // Host in Room Alpha
      const sockAlpha = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sockAlpha);
      await new Promise<void>((resolve) => sockAlpha.on('connect', () => resolve()));
      sockAlpha.emit('join_study_room', { roomId: testRoomId });

      // Stranger in Room Beta
      const sockBeta = ClientSocket(serverUrl, {
        auth: { token: strangerUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(sockBeta);
      await new Promise<void>((resolve) => sockBeta.on('connect', () => resolve()));
      sockBeta.emit('join_study_room', { roomId: secondRoomId });

      await new Promise((r) => setTimeout(r, 100));

      // Attempt cross-room offer from Room Alpha to Room Beta
      let offerLeaked = false;
      sockBeta.once('webrtc_offer', () => {
        offerLeaked = true;
      });

      sockAlpha.emit('webrtc_offer', {
        targetSocketId: sockBeta.id,
        offer: { type: 'offer', sdp: 'cross-room-leak' },
      });

      // Wait 300ms to verify no offer arrives
      await new Promise((r) => setTimeout(r, 300));
      expect(offerLeaked).toBe(false);
    });

    it('Blocks whiteboard and hand raise events if socket has not joined the room', async () => {
      // Stranger socket NOT in Room Alpha
      const strangerSock = ClientSocket(serverUrl, {
        auth: { token: strangerUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(strangerSock);
      await new Promise<void>((resolve) => strangerSock.on('connect', () => resolve()));

      // Host socket in Room Alpha
      const hostSock = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(hostSock);
      await new Promise<void>((resolve) => hostSock.on('connect', () => resolve()));
      hostSock.emit('join_study_room', { roomId: testRoomId });
      await new Promise((r) => setTimeout(r, 100));

      let strokeReceived = false;
      hostSock.once('whiteboard_stroke', () => {
        strokeReceived = true;
      });

      // Stranger tries to inject whiteboard stroke without joining room
      strangerSock.emit('whiteboard_stroke', {
        roomId: testRoomId,
        stroke: { type: 'draw', color: '#FF0000' },
      });

      await new Promise((r) => setTimeout(r, 200));
      expect(strokeReceived).toBe(false);
    });
  });

  describe('5. Participant Removal & Rejoin Prevention', () => {
    it('Host removes participant; socket leaves and cannot rejoin via socket or REST', async () => {
      // Member joins Room Alpha
      const memberSock = ClientSocket(serverUrl, {
        auth: { token: memberUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(memberSock);
      await new Promise<void>((resolve) => memberSock.on('connect', () => resolve()));
      memberSock.emit('join_study_room', { roomId: testRoomId });
      await new Promise((r) => setTimeout(r, 100));

      const removedEventPromise = new Promise<any>((resolve) => {
        memberSock.once('participant_removed', (data) => resolve(data));
      });

      // Host removes member via REST
      const removeRes = await request(app)
        .delete(`/api/rooms/${testRoomId}/participants/${memberUser.id}`)
        .set('Authorization', `Bearer ${hostUser.token}`);

      expect(removeRes.status).toBe(200);

      // Verify socket receives participant_removed notification
      const removedData = await removedEventPromise;
      expect(removedData.userId).toBe(memberUser.id);
      expect(removedData.roomId).toBe(testRoomId);

      // Verify removed participant cannot rejoin via socket join_study_room
      const roomErrorPromise = new Promise<any>((resolve) => {
        memberSock.once('room_error', (data) => resolve(data));
      });
      memberSock.emit('join_study_room', { roomId: testRoomId });
      const roomErr = await roomErrorPromise;
      expect(roomErr.error).toMatch(/removed/i);

      // Verify removed participant cannot rejoin via POST /api/rooms/:id/join
      const joinRes = await request(app)
        .post(`/api/rooms/${testRoomId}/join`)
        .set('Authorization', `Bearer ${memberUser.token}`);
      expect(joinRes.status).toBe(403);
      expect(joinRes.body.error).toMatch(/removed/i);

      // Verify removed participant cannot access room details via GET /api/rooms/:id
      const getRes = await request(app)
        .get(`/api/rooms/${testRoomId}`)
        .set('Authorization', `Bearer ${memberUser.token}`);
      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toMatch(/removed/i);
    });
  });

  describe('6. Chat History Bug & Cursor Pagination (Latest N Messages after 150 inserts)', () => {
    it('Returns latest 100 messages chronologically after 150 inserts, with before cursor support', async () => {
      const convUserA = hostUser.id;
      const convUserB = strangerUser.id;

      // Insert 150 sequential messages
      const baseTime = Date.now() - 300000;
      const messageIds: string[] = [];
      const timestamps: string[] = [];

      for (let i = 1; i <= 150; i++) {
        const id = crypto.randomUUID();
        const ts = new Date(baseTime + i * 1000).toISOString();
        messageIds.push(id);
        timestamps.push(ts);

        db.prepare(`
          INSERT INTO messages (id, conversation_type, sender_id, recipient_id, content, created_at)
          VALUES (?, 'direct', ?, ?, ?, ?)
        `).run(id, i % 2 === 0 ? convUserA : convUserB, i % 2 === 0 ? convUserB : convUserA, `Test message #${i}`, ts);
      }

      // 1. Fetch default page (should return latest 100, i.e., messages 51 to 150)
      const resLatest = await request(app)
        .get(`/api/messages/direct/${convUserB}`)
        .set('Authorization', `Bearer ${hostUser.token}`);

      expect(resLatest.status).toBe(200);
      expect(resLatest.body.messages.length).toBe(100);

      // Verify chronological order (oldest of the page first, newest of the page last)
      const latestList = resLatest.body.messages;
      expect(latestList[0].content).toBe('Test message #51');
      expect(latestList[99].content).toBe('Test message #150');

      // 2. Fetch older page using before cursor (?before=<timestamp of message #51>)
      const cursorTimestamp = latestList[0].created_at;
      const resOlder = await request(app)
        .get(`/api/messages/direct/${convUserB}?before=${encodeURIComponent(cursorTimestamp)}&limit=50`)
        .set('Authorization', `Bearer ${hostUser.token}`);

      expect(resOlder.status).toBe(200);
      expect(resOlder.body.messages.length).toBe(50);
      expect(resOlder.body.messages[0].content).toBe('Test message #1');
      expect(resOlder.body.messages[49].content).toBe('Test message #50');
    });
  });

  describe('7. Forged Client Socket Messages Blocked', () => {
    it('Direct and group message forged socket events no longer deliver anything', async () => {
      const recipientSock = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(recipientSock);
      await new Promise<void>((resolve) => recipientSock.on('connect', () => resolve()));

      const senderSock = ClientSocket(serverUrl, {
        auth: { token: memberUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(senderSock);
      await new Promise<void>((resolve) => senderSock.on('connect', () => resolve()));

      let forgedDirectDelivered = false;
      recipientSock.once('direct_message_received', () => {
        forgedDirectDelivered = true;
      });

      // Emitting client-trusting event should do NOTHING
      senderSock.emit('direct_message_sent', {
        recipientId: hostUser.id,
        message: { content: 'Forged fake message' },
      });

      await new Promise((r) => setTimeout(r, 200));
      expect(forgedDirectDelivered).toBe(false);

      // Now send via legitimate authenticated REST endpoint
      const deliveredPromise = new Promise<any>((resolve) => {
        recipientSock.once('direct_message_received', (data) => resolve(data));
      });

      const restRes = await request(app)
        .post(`/api/messages/direct/${hostUser.id}`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ content: 'Legitimate authenticated message' });

      expect(restRes.status).toBe(201);
      const delivered = await deliveredPromise;
      expect(delivered.content).toBe('Legitimate authenticated message');
      expect(delivered.sender_id).toBe(memberUser.id);
    });
  });

  describe('8. Direct Message Validation & Security Guards', () => {
    it('Returns 404 when recipient does not exist or is inactive', async () => {
      const nonexistentId = crypto.randomUUID();
      const resNonexistent = await request(app)
        .post(`/api/messages/direct/${nonexistentId}`)
        .set('Authorization', `Bearer ${hostUser.token}`)
        .send({ content: 'Hello' });
      expect(resNonexistent.status).toBe(404);

      const resInactive = await request(app)
        .post(`/api/messages/direct/${deactivatedUser.id}`)
        .set('Authorization', `Bearer ${hostUser.token}`)
        .send({ content: 'Hello' });
      expect(resInactive.status).toBe(404);
    });

    it('Rejects direct message content exceeding 4000 characters', async () => {
      const longContent = 'A'.repeat(4001);
      const res = await request(app)
        .post(`/api/messages/direct/${memberUser.id}`)
        .set('Authorization', `Bearer ${hostUser.token}`)
        .send({ content: longContent });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/4000/);
    });

    it('Rejects non-http/https attachment URLs', async () => {
      const res = await request(app)
        .post(`/api/messages/direct/${memberUser.id}`)
        .set('Authorization', `Bearer ${hostUser.token}`)
        .send({
          content: 'Here is a file',
          attachment_url: 'javascript:alert(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/http or https/i);
    });
  });

  describe('9. Whiteboard REST Access Control & Size Cap', () => {
    it('Non-member cannot access or update whiteboard state via REST', async () => {
      const getRes = await request(app)
        .get(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${strangerUser.token}`);
      expect(getRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${strangerUser.token}`)
        .send({ canvasData: '[]' });
      expect(putRes.status).toBe(403);
    });

    it('Capped canvasData size rejects payloads exceeding 2MB', async () => {
      const hugeData = 'X'.repeat(2 * 1024 * 1024 + 10);
      const res = await request(app)
        .put(`/api/rooms/${testRoomId}/whiteboard`)
        .set('Authorization', `Bearer ${hostUser.token}`)
        .send({ canvasData: hugeData });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/2MB/i);
    });
  });

  describe('10. Hand Raise Single Source of Truth via REST', () => {
    it('REST toggle hand broadcasts user_hand_toggled and updates state', async () => {
      const hostSock = ClientSocket(serverUrl, {
        auth: { token: hostUser.token },
        transports: ['websocket'],
        reconnection: false,
      });
      activeSockets.push(hostSock);
      await new Promise<void>((resolve) => hostSock.on('connect', () => resolve()));
      hostSock.emit('join_study_room', { roomId: testRoomId });
      await new Promise((r) => setTimeout(r, 100));

      const handEventPromise = new Promise<any>((resolve) => {
        hostSock.once('user_hand_toggled', (data) => resolve(data));
      });

      const res = await request(app)
        .post(`/api/rooms/${testRoomId}/hand`)
        .set('Authorization', `Bearer ${hostUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.isHandRaised).toBe(1);

      const handEvent = await handEventPromise;
      expect(handEvent.userId).toBe(hostUser.id);
      expect(handEvent.isHandRaised).toBe(true);
    });
  });
});
