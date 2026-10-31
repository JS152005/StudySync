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

export function setupSocketHandlers(io: Server) {
  // Authentication middleware for Socket.io
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
        if (decoded?.userId) {
          const user = db.prepare('SELECT id, username, full_name, avatar_url FROM users WHERE id = ?').get(decoded.userId) as any;
          if (user) {
            socket.userId = user.id;
            socket.username = user.username;
            socket.fullName = user.full_name;
          }
        }
      }
      next();
    } catch {
      // Allow connection with unauthenticated socket if token missing
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Join user's personal channel for direct notifications/messages
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // 1. STUDY ROOMS & WEBRTC SIGNALING
    socket.on('join_study_room', ({ roomId }) => {
      if (!roomId) return;

      const roomState = getOrCreateRoomState(roomId);

      // Verify room authorization if user is logged in
      if (socket.userId) {
        const room = db.prepare('SELECT * FROM study_rooms WHERE id = ? AND is_active = 1').get(roomId) as any;
        if (!room) {
          socket.emit('room_error', { error: 'Study room is inactive or does not exist.' });
          return;
        }

        // Host check
        if (room.host_id) {
          roomState.hostUserId = room.host_id;
        }

        const isHost = room.host_id === socket.userId;
        let isMember = false;
        if (room.group_id) {
          const gm = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = "active"').get(room.group_id, socket.userId);
          isMember = !!gm;
        }
        const hasJoined = db.prepare('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?').get(roomId, socket.userId);
        const hasInvite = db.prepare('SELECT id FROM room_invitations WHERE room_id = ? AND invitee_id = ?').get(roomId, socket.userId);

        const now = new Date().toISOString();
        if (!isHost && !isMember && !hasJoined && !hasInvite) {
          try {
            db.prepare('INSERT INTO room_participants (id, room_id, user_id, is_hand_raised, joined_at) VALUES (?, ?, ?, 0, ?)')
              .run(crypto.randomUUID(), roomId, socket.userId, now);
          } catch {
            // ignore duplicate
          }
        } else {
          // Reactivate participant in DB
          try {
            db.prepare('UPDATE room_participants SET left_at = NULL WHERE room_id = ? AND user_id = ?').run(roomId, socket.userId);
          } catch {
            // ignore
          }
        }
      }

      socket.join(`room:${roomId}`);

      const userId = socket.userId || `guest_${socket.id}`;
      const username = socket.username || 'Student';
      const fullName = socket.fullName || 'Student';
      const isHost = socket.userId ? roomState.hostUserId === socket.userId : false;

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
      if (roomState) {
        const userId = socket.userId || `guest_${socket.id}`;
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
            if (socket.userId) {
              try {
                db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
                  .run(new Date().toISOString(), roomId, socket.userId);
              } catch {
                // ignore
              }
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
        }
      }
    });

    // WebRTC: Relay Offer
    socket.on('webrtc_offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('webrtc_offer', {
        senderSocketId: socket.id,
        senderUserId: socket.userId,
        offer,
      });
    });

    // WebRTC: Relay Answer
    socket.on('webrtc_answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc_answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    // WebRTC: Relay ICE Candidate
    socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc_ice_candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // User Media State (Camera/Mic mute status broadcast)
    socket.on('user_media_state_changed', ({ roomId, videoEnabled, audioEnabled }) => {
      if (!roomId) return;
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

    // 2. SCREEN SHARING BROADCAST & INDICATORS
    socket.on('screen_share_started', ({ roomId }) => {
      if (!roomId) return;
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
      if (!roomId) return;
      const roomState = roomStates.get(roomId);
      if (roomState && roomState.screenSharer && roomState.screenSharer.userId === socket.userId) {
        roomState.screenSharer = null;
      }
      io.to(`room:${roomId}`).emit('screen_share_stopped', { roomId, userId: socket.userId });
    });

    // 3. COLLABORATIVE WHITEBOARD BROADCAST & PERSISTENT HISTORY
    socket.on('whiteboard_share_started', ({ roomId }) => {
      if (!roomId) return;
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
      if (!roomId) return;
      const roomState = roomStates.get(roomId);
      if (roomState && roomState.whiteboardSharer && roomState.whiteboardSharer.userId === socket.userId) {
        roomState.whiteboardSharer = null;
      }
      io.to(`room:${roomId}`).emit('whiteboard_share_stopped', { roomId, userId: socket.userId });
    });

    socket.on('whiteboard_stroke', ({ roomId, stroke }) => {
      if (!roomId || !stroke) return;
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
    });

    socket.on('whiteboard_clear', ({ roomId }) => {
      if (!roomId) return;
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

    // 4. GROUP & DIRECT CHAT REAL-TIME
    socket.on('join_group_chat', ({ groupId }) => {
      if (!groupId) return;
      if (socket.userId) {
        const member = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = "active"').get(groupId, socket.userId);
        if (member) {
          socket.join(`group:${groupId}`);
        }
      } else {
        socket.join(`group:${groupId}`);
      }
    });

    socket.on('group_message_sent', ({ groupId, message }) => {
      if (!groupId || !message) return;
      if (socket.userId) {
        const member = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = "active"').get(groupId, socket.userId);
        if (!member) {
          socket.emit('chat_error', { error: 'You are not a member of this study group.' });
          return;
        }
      }
      io.to(`group:${groupId}`).emit('group_message_received', message);
    });

    socket.on('direct_message_sent', ({ recipientId, message }) => {
      if (!recipientId || !message) return;
      io.to(`user:${recipientId}`).emit('direct_message_received', message);
      if (socket.userId) {
        socket.to(`user:${socket.userId}`).emit('direct_message_received', message);
      }
    });

    // 5. ROOM INVITATIONS
    socket.on('room_invitation_sent', ({ targetUserId, invitation }) => {
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('room_invitation_received', invitation);
      }
    });

    // 6. HAND RAISE IN STUDY ROOMS
    socket.on('toggle_hand', ({ roomId, isHandRaised }) => {
      if (!roomId) return;
      const roomState = getOrCreateRoomState(roomId);
      const userId = socket.userId || `guest_${socket.id}`;
      const p = roomState.participants.get(userId);
      if (p) {
        p.isHandRaised = !!isHandRaised;
      }

      io.to(`room:${roomId}`).emit('user_hand_toggled', {
        userId: socket.userId,
        username: socket.username,
        fullName: socket.fullName,
        isHandRaised: !!isHandRaised,
      });

      broadcastParticipantsSnapshot(io, roomId);
    });

    // Disconnect cleanup
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('room:')) {
          const roomId = room.replace('room:', '');
          const roomState = roomStates.get(roomId);
          if (roomState) {
            const userId = socket.userId || `guest_${socket.id}`;
            const participant = roomState.participants.get(userId);

            if (participant) {
              participant.sockets.delete(socket.id);

              // If no remaining active sockets for this user in this room
              if (participant.sockets.size === 0) {
                roomState.participants.delete(userId);

                // Check if this user was the screen sharer
                if (roomState.screenSharer && roomState.screenSharer.userId === userId) {
                  roomState.screenSharer = null;
                  socket.to(room).emit('screen_share_stopped', { roomId, userId });
                }

                // Check if this user was the whiteboard sharer
                if (roomState.whiteboardSharer && roomState.whiteboardSharer.userId === userId) {
                  roomState.whiteboardSharer = null;
                  socket.to(room).emit('whiteboard_share_stopped', { roomId, userId });
                }

                // Update participant leave timestamp in DB
                if (socket.userId) {
                  try {
                    db.prepare('UPDATE room_participants SET left_at = ? WHERE room_id = ? AND user_id = ? AND left_at IS NULL')
                      .run(new Date().toISOString(), roomId, socket.userId);
                  } catch {
                    // ignore
                  }
                }

                socket.to(room).emit('peer_left', {
                  socketId: socket.id,
                  userId,
                });
              } else {
                participant.primarySocketId = Array.from(participant.sockets)[0];
              }

              broadcastParticipantsSnapshot(io, roomId);
            }
          }
        }
      }
    });
  });
}
