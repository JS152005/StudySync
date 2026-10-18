import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  fullName?: string;
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware for Socket.io
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
        if (decoded?.userId) {
          const user = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(decoded.userId) as any;
          if (user) {
            socket.userId = user.id;
            socket.username = user.username;
            socket.fullName = user.full_name;
          }
        }
      }
      next();
    } catch {
      // Allow connection but with unauthenticated socket if needed, or proceed
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
      socket.join(`room:${roomId}`);

      // Notify others in room of new peer for WebRTC
      socket.to(`room:${roomId}`).emit('peer_joined', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        fullName: socket.fullName,
      });

      // Get list of existing peers in the room
      const clientsInRoom = io.sockets.adapter.rooms.get(`room:${roomId}`);
      const peers = [];
      if (clientsInRoom) {
        for (const clientId of clientsInRoom) {
          if (clientId !== socket.id) {
            const clientSocket = io.sockets.sockets.get(clientId) as AuthenticatedSocket;
            peers.push({
              socketId: clientId,
              userId: clientSocket?.userId,
              username: clientSocket?.username,
              fullName: clientSocket?.fullName,
            });
          }
        }
      }
      socket.emit('existing_peers', { peers });
    });

    socket.on('leave_study_room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('peer_left', {
        socketId: socket.id,
        userId: socket.userId,
      });
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

    // 2. COLLABORATIVE WHITEBOARD
    socket.on('whiteboard_draw', ({ roomId, action }) => {
      socket.to(`room:${roomId}`).emit('whiteboard_draw', action);
    });

    socket.on('whiteboard_clear', ({ roomId }) => {
      socket.to(`room:${roomId}`).emit('whiteboard_clear');
    });

    // 3. DOUBT QUEUE REAL-TIME EVENTS
    socket.on('doubt_created', ({ roomId, groupId, doubt }) => {
      if (roomId) io.to(`room:${roomId}`).emit('doubt_created', doubt);
      if (groupId) io.to(`group:${groupId}`).emit('doubt_created', doubt);
    });

    socket.on('doubt_voted', ({ roomId, groupId, doubtId, votes_count }) => {
      if (roomId) io.to(`room:${roomId}`).emit('doubt_voted', { doubtId, votes_count });
      if (groupId) io.to(`group:${groupId}`).emit('doubt_voted', { doubtId, votes_count });
    });

    socket.on('doubt_status_changed', ({ roomId, groupId, doubtId, status }) => {
      if (roomId) io.to(`room:${roomId}`).emit('doubt_status_changed', { doubtId, status });
      if (groupId) io.to(`group:${groupId}`).emit('doubt_status_changed', { doubtId, status });
    });

    // 4. GROUP & DIRECT CHAT REAL-TIME
    socket.on('join_group_chat', ({ groupId }) => {
      socket.join(`group:${groupId}`);
    });

    socket.on('group_message_sent', ({ groupId, message }) => {
      io.to(`group:${groupId}`).emit('group_message_received', message);
    });

    socket.on('direct_message_sent', ({ recipientId, message }) => {
      io.to(`user:${recipientId}`).emit('direct_message_received', message);
    });

    // 5. GROUP FOCUS PACT TIMER SYNC
    socket.on('join_focus_session', ({ sessionId }) => {
      socket.join(`focus:${sessionId}`);
    });

    socket.on('focus_timer_sync', ({ sessionId, session, timing }) => {
      io.to(`focus:${sessionId}`).emit('focus_timer_sync', { session, timing });
    });

    // 6. TEACH MODE HAND RAISE
    socket.on('toggle_hand', ({ roomId, isHandRaised }) => {
      io.to(`room:${roomId}`).emit('user_hand_toggled', {
        userId: socket.userId,
        username: socket.username,
        fullName: socket.fullName,
        isHandRaised,
      });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('room:')) {
          socket.to(room).emit('peer_left', {
            socketId: socket.id,
            userId: socket.userId,
          });
        }
      }
    });
  });
}
