import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  fullName?: string;
}

export interface SharerInfo {
  userId: string;
  username: string;
  fullName: string;
  socketId: string;
}

export interface LogicalParticipant {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  isHost: boolean;
  isHandRaised: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  primarySocketId: string;
  sockets: Set<string>;
  joinedAt: string;
}

export interface RoomState {
  roomId: string;
  hostUserId: string;
  participants: Map<string, LogicalParticipant>; // Keyed by userId
  screenSharer: SharerInfo | null;
  whiteboardSharer: SharerInfo | null;
  whiteboardVersion: number;
}

// Authoritative in-memory room states
const roomStates = new Map<string, RoomState>();

export function getOrCreateRoomState(roomId: string): RoomState {
  let state = roomStates.get(roomId);
  if (!state) {
    let hostId = '';
    try {
      const room = db.prepare('SELECT host_id FROM study_rooms WHERE id = ?').get(roomId) as any;
      if (room?.host_id) hostId = room.host_id;
    } catch {
      // ignore
    }

    let maxSeq = 0;
    try {
      const row = db.prepare('SELECT MAX(sequence_number) as max_seq FROM whiteboard_actions WHERE room_id = ?').get(roomId) as any;
      if (row?.max_seq) maxSeq = row.max_seq;
    } catch {
      // ignore
    }

    state = {
      roomId,
      hostUserId: hostId,
      participants: new Map(),
      screenSharer: null,
      whiteboardSharer: null,
      whiteboardVersion: maxSeq,
    };
    roomStates.set(roomId, state);
  }
  return state;
}

export function removeRoomState(roomId: string): void {
  roomStates.delete(roomId);
}

export function removeParticipantFromRoomState(roomId: string, userId: string): void {
  const state = roomStates.get(roomId);
  if (state) {
    state.participants.delete(userId);
    if (state.screenSharer?.userId === userId) {
      state.screenSharer = null;
    }
    if (state.whiteboardSharer?.userId === userId) {
      state.whiteboardSharer = null;
    }
  }
}

export function broadcastParticipantsSnapshot(io: Server, roomId: string) {
  const state = roomStates.get(roomId);
  if (!state) return;

  const participantsList = Array.from(state.participants.values()).map((p) => ({
    userId: p.userId,
    username: p.username,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl || '',
    isHost: p.isHost,
    isHandRaised: p.isHandRaised,
    videoEnabled: p.videoEnabled,
    audioEnabled: p.audioEnabled,
    socketId: p.primarySocketId,
    joinedAt: p.joinedAt,
  }));

  io.to(`room:${roomId}`).emit('room_participants_updated', {
    roomId,
    participantCount: state.participants.size,
    participants: participantsList,
  });
}

function isSocketInStudyRoom(sock: AuthenticatedSocket, roomId: string): boolean {
  return Boolean(roomId && sock.rooms && sock.rooms.has(`room:${roomId}`));
}

function socketsShareStudyRoom(sock1: AuthenticatedSocket, targetSocketId: string, ioServer: Server): boolean {
  if (!sock1?.rooms || !targetSocketId) return false;
  const targetSocket = ioServer.sockets.sockets.get(targetSocketId);
  if (!targetSocket?.rooms) return false;
  for (const r of sock1.rooms) {
    if (r.startsWith('room:') && targetSocket.rooms.has(r)) {
      return true;
    }
  }
  return false;
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware for Socket.io
  // Reject connection unless the JWT is valid and the user is active and verified.
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      // Check cookie header if token not sent in auth payload or authorization header
      if (!token && socket.handshake.headers?.cookie) {
        const cookieHeader = socket.handshake.headers.cookie;
        const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (!token) {
        return next(new Error('unauthorized'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      if (!decoded || !decoded.userId) {
        return next(new Error('unauthorized'));
      }

      const user = db.prepare(`
        SELECT id, username, full_name, avatar_url, is_active, is_verified 
        FROM users WHERE id = ?
      `).get(decoded.userId) as any;

      if (!user || user.is_active === 0 || user.is_verified !== 1) {
        return next(new Error('unauthorized'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.fullName = user.full_name;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Join user's personal channel for direct notifications/messages
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // 1. STUDY ROOMS & WEBRTC SIGNALING
    socket.on('join_study_room', ({ roomId }) => {
      if (!roomId || !socket.userId) return;

      const room = db.prepare('SELECT * FROM study_rooms WHERE id = ? AND is_active = 1').get(roomId) as any;
      if (!room) {
        socket.emit('room_error', { error: 'Study room is inactive or does not exist.' });
        return;
      }

      // Check if user has been removed from this room
      const removed = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND is_removed = 1').get(roomId, socket.userId);
      if (removed) {
        socket.emit('room_error', { error: 'You have been removed from this study room and cannot rejoin.' });
        return;
      }

      const isHost = room.host_id === socket.userId;
      let isGroupMember = false;
      if (room.group_id) {
        const gm = db.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'").get(room.group_id, socket.userId);
        isGroupMember = !!gm;
      }
      const activeParticipant = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL').get(roomId, socket.userId);

      // join_study_room must succeed only if room is active AND user is host, active participant (left_at IS NULL), or active group member
      if (!isHost && !isGroupMember && !activeParticipant) {
        socket.emit('room_error', { error: 'Unauthorized to join study room. Group membership or room invitation required.' });
        return;
      }

      const roomState = getOrCreateRoomState(roomId);
      if (room.host_id) {
        roomState.hostUserId = room.host_id;
      }

      const now = new Date().toISOString();
      if (!activeParticipant) {
        const prevRow = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?').get(roomId, socket.userId) as any;
        if (prevRow) {
          db.prepare('UPDATE room_participants SET left_at = NULL WHERE id = ?').run(prevRow.id);
        } else {
          try {
            db.prepare('INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, is_removed, joined_at) VALUES (?, ?, ?, 0, 0, ?)')
              .run(crypto.randomUUID(), roomId, socket.userId, now);
          } catch {
            // ignore duplicate
          }
        }
      }

      socket.join(`room:${roomId}`);

      const userId = socket.userId;
      const username = socket.username || 'Student';
      const fullName = socket.fullName || 'Student';

      let existingParticipant = roomState.participants.get(userId);
      const isNewLogicalUser = !existingParticipant;

      if (existingParticipant) {
        // Multi-tab / Reconnect: Register new socket under same logical student
        existingParticipant.sockets.add(socket.id);
        existingParticipant.primarySocketId = socket.id;
      } else {
        existingParticipant = {
          userId,
          username,
          fullName,
          avatarUrl: '',
          isHost,
          isHandRaised: false,
          videoEnabled: false,
          audioEnabled: false,
          primarySocketId: socket.id,
          sockets: new Set([socket.id]),
          joinedAt: new Date().toISOString(),
        };
        roomState.participants.set(userId, existingParticipant);
      }

      // Notify other peers for WebRTC if new logical participant
      if (isNewLogicalUser) {
        socket.to(`room:${roomId}`).emit('peer_joined', {
          socketId: socket.id,
          userId,
          username,
          fullName,
        });
      }

      // Send existing peers list (only from OTHER distinct users!)
      const peers = [];
      for (const [otherUserId, p] of roomState.participants) {
        if (otherUserId !== userId) {
          peers.push({
            socketId: p.primarySocketId,
            userId: p.userId,
            username: p.username,
            fullName: p.fullName,
            videoEnabled: p.videoEnabled,
            audioEnabled: p.audioEnabled,
          });
        }
      }

      socket.emit('existing_peers', { peers });

      // Synchronize full room media state to joining peer
      socket.emit('room_media_state', {
        roomId,
        activeScreenSharer: roomState.screenSharer,
        activeWhiteboardSharer: roomState.whiteboardSharer,
      });

      // Synchronize full whiteboard actions history to joining peer
      try {
        const recentActions = db.prepare(`
          SELECT id, sequence_number, user_id, action_type, payload, created_at
          FROM whiteboard_actions
          WHERE room_id = ?
          ORDER BY sequence_number ASC
        `).all(roomId) as any[];

        socket.emit('whiteboard_snapshot', {
          version: roomState.whiteboardVersion,
          actions: recentActions.map((a) => {
            let parsed = null;
            try { parsed = JSON.parse(a.payload); } catch { parsed = a.payload; }
            return {
              id: a.id,
              sequenceNumber: a.sequence_number,
              userId: a.user_id,
              actionType: a.action_type,
              stroke: parsed,
              createdAt: a.created_at,
            };
          }),
        });
      } catch (err) {
        console.error('[DB] Failed to load whiteboard snapshot on join:', err);
      }

      // Broadcast authoritative unique participant snapshot
      broadcastParticipantsSnapshot(io, roomId);
    });

    socket.on('leave_study_room', ({ roomId }) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);

      const roomState = roomStates.get(roomId);
      if (roomState && socket.userId) {
        const userId = socket.userId;
        const participant = roomState.participants.get(userId);

        if (participant) {
          participant.sockets.delete(socket.id);

          // If no more sockets for this user, they have logically left!
          if (participant.sockets.size === 0) {
            roomState.participants.delete(userId);

            // Screen share cleanup
            if (roomState.screenSharer && roomState.screenSharer.userId === userId) {
              roomState.screenSharer = null;
              io.to(`room:${roomId}`).emit('screen_share_stopped', { roomId, userId });
            }

            // Whiteboard share cleanup
            if (roomState.whiteboardSharer && roomState.whiteboardSharer.userId === userId) {
              roomState.whiteboardSharer = null;
              io.to(`room:${roomId}`).emit('whiteboard_share_stopped', { roomId, userId });
            }

            // Update participant departure in DB
            try {
              db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
                .run(new Date().toISOString(), roomId, userId);
            } catch {
              // ignore
            }

            socket.to(`room:${roomId}`).emit('peer_left', {
              socketId: socket.id,
              userId,
            });
          } else {
            // User still has another active tab, reassign primarySocketId
            participant.primarySocketId = Array.from(participant.sockets)[0];
          }

          broadcastParticipantsSnapshot(io, roomId);

          // Clean up roomState if no participants remain
          if (roomState.participants.size === 0) {
            roomStates.delete(roomId);
          }
        }
      }
    });

    // WebRTC: Relay Offer (target socket must be in the same room as the sender)
    socket.on('webrtc_offer', ({ targetSocketId, offer }) => {
      if (!targetSocketId || !offer || !socketsShareStudyRoom(socket, targetSocketId, io)) return;
      io.to(targetSocketId).emit('webrtc_offer', {
        senderSocketId: socket.id,
        senderUserId: socket.userId,
        offer,
      });
    });

    // WebRTC: Relay Answer (target socket must be in the same room as the sender)
    socket.on('webrtc_answer', ({ targetSocketId, answer }) => {
      if (!targetSocketId || !answer || !socketsShareStudyRoom(socket, targetSocketId, io)) return;
      io.to(targetSocketId).emit('webrtc_answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    // WebRTC: Relay ICE Candidate (target socket must be in the same room as the sender)
    socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => {
      if (!targetSocketId || !candidate || !socketsShareStudyRoom(socket, targetSocketId, io)) return;
      io.to(targetSocketId).emit('webrtc_ice_candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // User Media State (Camera/Mic mute status broadcast - only if sender joined room)
    socket.on('user_media_state_changed', ({ roomId, videoEnabled, audioEnabled }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = getOrCreateRoomState(roomId);
      const userId = socket.userId || `guest_${socket.id}`;
      const p = roomState.participants.get(userId);
      if (p) {
        p.videoEnabled = !!videoEnabled;
        p.audioEnabled = !!audioEnabled;
      }

      socket.to(`room:${roomId}`).emit('user_media_state_changed', {
        socketId: socket.id,
        userId: socket.userId,
        videoEnabled: !!videoEnabled,
        audioEnabled: !!audioEnabled,
      });

      broadcastParticipantsSnapshot(io, roomId);
    });

    // 2. SCREEN SHARING BROADCAST & INDICATORS (only if sender joined room)
    socket.on('screen_share_started', ({ roomId }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = getOrCreateRoomState(roomId);
      const sharer: SharerInfo = {
        userId: socket.userId || 'guest',
        username: socket.username || 'Student',
        fullName: socket.fullName || 'Student',
        socketId: socket.id,
      };
      roomState.screenSharer = sharer;
      io.to(`room:${roomId}`).emit('screen_share_started', sharer);
    });

    socket.on('screen_share_stopped', ({ roomId }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = roomStates.get(roomId);
      if (roomState && roomState.screenSharer && roomState.screenSharer.userId === socket.userId) {
        roomState.screenSharer = null;
      }
      io.to(`room:${roomId}`).emit('screen_share_stopped', { roomId, userId: socket.userId });
    });

    // 3. COLLABORATIVE WHITEBOARD BROADCAST & PERSISTENT HISTORY (only if sender joined room)
    socket.on('whiteboard_share_started', ({ roomId }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = getOrCreateRoomState(roomId);
      const sharer: SharerInfo = {
        userId: socket.userId || 'guest',
        username: socket.username || 'Student',
        fullName: socket.fullName || 'Student',
        socketId: socket.id,
      };
      roomState.whiteboardSharer = sharer;
      io.to(`room:${roomId}`).emit('whiteboard_share_started', sharer);
    });

    socket.on('whiteboard_share_stopped', ({ roomId }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = roomStates.get(roomId);
      if (roomState && roomState.whiteboardSharer && roomState.whiteboardSharer.userId === socket.userId) {
        roomState.whiteboardSharer = null;
      }
      io.to(`room:${roomId}`).emit('whiteboard_share_stopped', { roomId, userId: socket.userId });
    });

    // Helper for persisting whiteboard strokes
    const handleWhiteboardAction = (roomId: string, stroke: any) => {
      if (!isSocketInStudyRoom(socket, roomId) || !stroke) return;
      const roomState = getOrCreateRoomState(roomId);
      roomState.whiteboardVersion += 1;
      const actionId = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          actionId,
          roomId,
          roomState.whiteboardVersion,
          socket.userId || 'guest',
          stroke.type || 'draw',
          JSON.stringify(stroke),
          now
        );
      } catch (err) {
        console.error('[DB] Failed to persist whiteboard stroke:', err);
      }

      io.to(`room:${roomId}`).emit('whiteboard_stroke', {
        id: actionId,
        sequenceNumber: roomState.whiteboardVersion,
        userId: socket.userId,
        stroke,
      });
    };

    socket.on('whiteboard_stroke', ({ roomId, stroke }) => {
      handleWhiteboardAction(roomId, stroke);
    });

    socket.on('whiteboard_draw', ({ roomId, stroke, draw }) => {
      handleWhiteboardAction(roomId, stroke || draw);
    });

    socket.on('whiteboard_clear', ({ roomId }) => {
      if (!isSocketInStudyRoom(socket, roomId)) return;
      const roomState = getOrCreateRoomState(roomId);
      roomState.whiteboardVersion += 1;
      const actionId = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO whiteboard_actions (id, room_id, sequence_number, user_id, action_type, payload, created_at)
          VALUES (?, ?, ?, ?, 'clear', '{}', ?)
        `).run(actionId, roomId, roomState.whiteboardVersion, socket.userId || 'guest', now);
      } catch (err) {
        console.error('[DB] Failed to persist whiteboard clear:', err);
      }

      io.to(`room:${roomId}`).emit('whiteboard_clear', {
        sequenceNumber: roomState.whiteboardVersion,
      });
    });

    // 4. GROUP CHAT REAL-TIME (join_group_chat must verify active group membership)
    socket.on('join_group_chat', ({ groupId }) => {
      if (!groupId || !socket.userId) return;
      const member = db.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'").get(groupId, socket.userId);
      if (!member) {
        socket.emit('chat_error', { error: 'You are not an active member of this study group.' });
        return;
      }
      socket.join(`group:${groupId}`);
    });

    socket.on('leave_group_chat', ({ groupId }) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
      }
    });

    // 5. ROOM INVITATIONS
    socket.on('room_invitation_sent', ({ targetUserId, invitation }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('room_invitation_received', invitation);
      }
    });

    // 6. HAND RAISE IN STUDY ROOMS (Scoped to joined room and verified participant)
    socket.on('toggle_hand', ({ roomId, isHandRaised }) => {
      if (!isSocketInStudyRoom(socket, roomId) || !socket.userId) return;

      const participant = db.prepare(`
        SELECT id, is_hand_raised FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL
      `).get(roomId, socket.userId) as any;
      if (!participant) return;

      const newHandState = isHandRaised !== undefined ? (isHandRaised ? 1 : 0) : (participant.is_hand_raised === 1 ? 0 : 1);
      try {
        db.prepare('UPDATE room_participants SET is_hand_raised = ? WHERE id = ?').run(newHandState, participant.id);
      } catch {
        // ignore
      }

      const roomState = getOrCreateRoomState(roomId);
      const p = roomState.participants.get(socket.userId);
      if (p) {
        p.isHandRaised = newHandState === 1;
      }

      io.to(`room:${roomId}`).emit('user_hand_toggled', {
        userId: socket.userId,
        username: socket.username,
        fullName: socket.fullName,
        isHandRaised: newHandState === 1,
      });

      broadcastParticipantsSnapshot(io, roomId);
    });

    // Disconnect cleanup: set left_at for that user's active room_participants row when their last socket in the room disconnects
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('room:')) {
          const roomId = room.replace('room:', '');
          const roomState = roomStates.get(roomId);
          const userId = socket.userId;

          if (roomState && userId) {
            const participant = roomState.participants.get(userId);

            if (participant) {
              participant.sockets.delete(socket.id);

              // If no remaining active sockets for this user in this room
              if (participant.sockets.size === 0) {
                roomState.participants.delete(userId);

                // Screen share cleanup
                if (roomState.screenSharer && roomState.screenSharer.userId === userId) {
                  roomState.screenSharer = null;
                  socket.to(room).emit('screen_share_stopped', { roomId, userId });
                }

                // Whiteboard share cleanup
                if (roomState.whiteboardSharer && roomState.whiteboardSharer.userId === userId) {
                  roomState.whiteboardSharer = null;
                  socket.to(room).emit('whiteboard_share_stopped', { roomId, userId });
                }

                // Update participant leave timestamp in DB
                try {
                  db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
                    .run(new Date().toISOString(), roomId, userId);
                } catch {
                  // ignore
                }

                socket.to(room).emit('peer_left', {
                  socketId: socket.id,
                  userId,
                });
              } else {
                participant.primarySocketId = Array.from(participant.sockets)[0];
              }

              broadcastParticipantsSnapshot(io, roomId);

              // Clean up roomState if no participants remain
              if (roomState.participants.size === 0) {
                roomStates.delete(roomId);
              }
            }
          } else if (userId) {
            const roomSockets = io.sockets.adapter.rooms.get(room);
            let hasOtherSocketInRoom = false;
            if (roomSockets) {
              for (const sId of roomSockets) {
                if (sId !== socket.id) {
                  const otherSock = io.sockets.sockets.get(sId) as AuthenticatedSocket;
                  if (otherSock && otherSock.userId === userId) {
                    hasOtherSocketInRoom = true;
                    break;
                  }
                }
              }
            }
            if (!hasOtherSocketInRoom) {
              try {
                db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
                  .run(new Date().toISOString(), roomId, userId);
              } catch {
                // ignore
              }
            }
          }
        }
      }
    });
  });
}
