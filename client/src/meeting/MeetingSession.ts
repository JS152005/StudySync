import { getSocket } from '../api/socket';
import { apiRequest } from '../api/client';
import {
  MeetingState,
  MeetingEvent,
  transitionMeetingState,
} from './meetingStateMachine';

export interface Participant {
  id?: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  is_host?: boolean;
  is_hand_raised?: number | boolean;
  video_enabled?: boolean;
  audio_enabled?: boolean;
  joined_at?: string;
  socket_id?: string;
}

export interface PeerInfo {
  socketId: string;
  userId?: string;
  username?: string;
  fullName?: string;
  stream?: MediaStream;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
  connectionState?: RTCPeerConnectionState;
}

export interface SharerInfo {
  userId: string;
  username: string;
  fullName: string;
  socketId: string;
}

export interface WhiteboardStrokeAction {
  id?: string;
  sequenceNumber?: number;
  userId?: string;
  actionType?: string;
  stroke: any;
  createdAt?: string;
}

export interface MeetingSnapshot {
  state: MeetingState;
  activeRoomId: string | null;
  roomData: any | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
  isHandRaised: boolean;
  activeScreenSharer: SharerInfo | null;
  activeWhiteboardSharer: SharerInfo | null;
  peersMap: Map<string, PeerInfo>;
  authoritativeParticipants: Participant[];
  participantCount: number;
  whiteboardActions: WhiteboardStrokeAction[];
  whiteboardVersion: number;
  deviceError: string;
  noiseSuppressionActive: boolean;
  activeView: 'video' | 'whiteboard';
  showParticipants: boolean;
}

export interface MeetingSessionDependencies {
  socket?: any;
  rtcConfig?: RTCConfiguration;
  PeerConnectionClass?: typeof RTCPeerConnection;
  mediaDevices?: MediaDevices;
  MediaStreamClass?: typeof MediaStream;
  apiRequestFn?: (endpoint: string, options?: any) => Promise<any>;
  currentUserId?: string;
}

export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function getAudioConstraints(): MediaTrackConstraints {
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints) {
    const supported = navigator.mediaDevices.getSupportedConstraints();
    return {
      echoCancellation: supported.echoCancellation !== false,
      noiseSuppression: supported.noiseSuppression !== false,
      autoGainControl: supported.autoGainControl !== false,
    };
  }
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

/**
 * Plain TypeScript MeetingSession class (NOT React state) that owns:
 * - Local media stream & screen share stream
 * - Map of RTCPeerConnections
 * - Remote streams & hidden audio playout elements
 * - Participants / peers map
 * - Whiteboard synchronization & active sharers
 * - Hand-raise state
 * - Socket.IO listeners (registered once on join, fully removed on leave)
 * - State machine transitions
 * - External store subscribe() / getSnapshot() pattern for React
 */
export class MeetingSession {
  private deps: MeetingSessionDependencies;
  private state: MeetingState = 'idle';
  private activeRoomId: string | null = null;
  private roomData: any | null = null;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioEnabled: boolean = false;
  private videoEnabled: boolean = false;
  private isSharingScreen: boolean = false;
  private isHandRaised: boolean = false;

  private activeScreenSharer: SharerInfo | null = null;
  private activeWhiteboardSharer: SharerInfo | null = null;

  private peersMap: Map<string, PeerInfo> = new Map();
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  private authoritativeParticipants: Participant[] = [];
  private participantCount: number = 1;

  private whiteboardActions: WhiteboardStrokeAction[] = [];
  private whiteboardVersion: number = 0;

  private deviceError: string = '';
  private noiseSuppressionActive: boolean = true;
  private activeView: 'video' | 'whiteboard' = 'video';
  private showParticipants: boolean = false;

  private listeners: Set<() => void> = new Set();
  private cachedSnapshot: MeetingSnapshot;
  private isSocketListening: boolean = false;
  private currentUserId: string | null = null;

  // Bound socket event listeners for reliable removal
  private handleExistingPeersBound: any;
  private handlePeerJoinedBound: any;
  private handleWebRTCOfferBound: any;
  private handleWebRTCAnswerBound: any;
  private handleICECandidateBound: any;
  private handlePeerLeftBound: any;
  private handleRoomMediaStateBound: any;
  private handleScreenShareStartedBound: any;
  private handleScreenShareStoppedBound: any;
  private handleWhiteboardShareStartedBound: any;
  private handleWhiteboardShareStoppedBound: any;
  private handleUserMediaStateChangedBound: any;
  private handleRoomParticipantsUpdatedBound: any;
  private handleWhiteboardSnapshotBound: any;
  private handleWhiteboardStrokeBound: any;
  private handleWhiteboardClearBound: any;
  private handleRoomEndedBound: any;
  private handleParticipantRemovedBound: any;
  private handleRoomErrorBound: any;
  private handleUnloadBound: any;

  constructor(deps: MeetingSessionDependencies = {}) {
    this.deps = deps;
    this.currentUserId = deps.currentUserId || null;

    this.cachedSnapshot = this.buildSnapshot();
    this.bindSocketListeners();

    // Browser unload handler: clean up session on page close/reload
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.handleUnloadBound = () => {
        if (this.activeRoomId) {
          try {
            navigator.sendBeacon?.(`/api/rooms/${this.activeRoomId}/leave`);
          } catch {}
          this.leave().catch(() => {});
        }
      };
      window.addEventListener('beforeunload', this.handleUnloadBound);
    }
  }

  public setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  private createMediaStream(tracks: MediaStreamTrack[] = []): MediaStream {
    const MSClass = this.deps.MediaStreamClass || (typeof window !== 'undefined' ? window.MediaStream : (globalThis as any).MediaStream);
    if (MSClass) {
      try {
        return new MSClass(tracks);
      } catch {
        try {
          const stream = new MSClass();
          tracks.forEach((t) => stream.addTrack(t));
          return stream;
        } catch {}
      }
    }
    // Safe fallback in test or headless environments
    const trackList = [...tracks];
    return {
      getTracks: () => trackList,
      getVideoTracks: () => trackList.filter((t) => t.kind === 'video'),
      getAudioTracks: () => trackList.filter((t) => t.kind === 'audio'),
      addTrack: (t: MediaStreamTrack) => trackList.push(t),
      removeTrack: (t: MediaStreamTrack) => {
        const idx = trackList.indexOf(t);
        if (idx >= 0) trackList.splice(idx, 1);
      },
    } as any;
  }

  // --- External Store API (useSyncExternalStore) ---

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): MeetingSnapshot => {
    return this.cachedSnapshot;
  };

  private notify() {
    this.cachedSnapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[MeetingSession] Listener error:', err);
      }
    });
  }

  private buildSnapshot(): MeetingSnapshot {
    return {
      state: this.state,
      activeRoomId: this.activeRoomId,
      roomData: this.roomData,
      localStream: this.localStream,
      screenStream: this.screenStream,
      audioEnabled: this.audioEnabled,
      videoEnabled: this.videoEnabled,
      isSharingScreen: this.isSharingScreen,
      isHandRaised: this.isHandRaised,
      activeScreenSharer: this.activeScreenSharer,
      activeWhiteboardSharer: this.activeWhiteboardSharer,
      peersMap: new Map(this.peersMap),
      authoritativeParticipants: [...this.authoritativeParticipants],
      participantCount: this.participantCount,
      whiteboardActions: [...this.whiteboardActions],
      whiteboardVersion: this.whiteboardVersion,
      deviceError: this.deviceError,
      noiseSuppressionActive: this.noiseSuppressionActive,
      activeView: this.activeView,
      showParticipants: this.showParticipants,
    };
  }

  private transition(event: MeetingEvent): MeetingState {
    const nextState = transitionMeetingState(this.state, event);
    if (nextState !== this.state) {
      this.state = nextState;
      this.notify();
    }
    return this.state;
  }

  // --- Dependency Accessors ---

  private getSocket() {
    return this.deps.socket || getSocket();
  }

  private getRTCConfig(): RTCConfiguration {
    return this.deps.rtcConfig || DEFAULT_RTC_CONFIG;
  }

  private getPeerConnectionClass(): typeof RTCPeerConnection {
    return this.deps.PeerConnectionClass || (typeof window !== 'undefined' ? window.RTCPeerConnection : (null as any));
  }

  private getMediaDevices(): MediaDevices | undefined {
    return this.deps.mediaDevices || (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);
  }

  private async makeApiRequest(endpoint: string, options?: any) {
    if (this.deps.apiRequestFn) {
      return this.deps.apiRequestFn(endpoint, options);
    }
    return apiRequest(endpoint, options);
  }

  // --- WebRTC Peer Connection Management ---

  private getOrCreatePeerConnection(peerSocketId: string, peerInfo?: Partial<PeerInfo>): RTCPeerConnection {
    let pc = this.peerConnections.get(peerSocketId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    const PCClass = this.getPeerConnectionClass();
    if (!PCClass) {
      throw new Error('RTCPeerConnection is not available in this environment');
    }

    pc = new PCClass(this.getRTCConfig());
    const socket = this.getSocket();

    // Add audio and video transceivers upfront so m= lines exist during initial SDP negotiation
    try {
      if (pc.addTransceiver) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    } catch {
      // Fallback
    }

    // Attach local active tracks
    const currentAudioTrack = this.localStream?.getAudioTracks()[0] || null;
    const currentVideoTrack = this.screenStream?.getVideoTracks()[0] || this.localStream?.getVideoTracks()[0] || null;

    const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
    const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');

    if (audioTransceiver && currentAudioTrack) {
      audioTransceiver.sender.replaceTrack(currentAudioTrack).catch(() => {});
    } else if (currentAudioTrack && this.localStream && pc.addTrack) {
      try { pc.addTrack(currentAudioTrack, this.localStream); } catch {}
    }

    if (videoTransceiver && currentVideoTrack) {
      videoTransceiver.sender.replaceTrack(currentVideoTrack).catch(() => {});
    } else if (currentVideoTrack && (this.screenStream || this.localStream) && pc.addTrack) {
      try { pc.addTrack(currentVideoTrack, (this.screenStream || this.localStream)!); } catch {}
    }

    // ICE Candidate Exchange
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote Track Handling
    pc.ontrack = (event) => {
      const track = event.track;
      const existing = this.peersMap.get(peerSocketId) || { socketId: peerSocketId };
      let stream = existing.stream;
      if (!stream) {
        stream = event.streams?.[0] || this.createMediaStream();
      }
      if (!stream.getTracks().some((t) => t.id === track.id)) {
        stream.addTrack(track);
      }

      // If audio track, attach to dedicated audio element for continuous playout across navigation
      if (track.kind === 'audio') {
        this.attachRemoteAudioTrack(peerSocketId, track);
      }

      track.onmute = () => this.notify();
      track.onunmute = () => this.notify();
      track.onended = () => this.notify();

      const isVideo = track.kind === 'video';
      const isAudio = track.kind === 'audio';

      this.peersMap.set(peerSocketId, {
        ...existing,
        stream: this.createMediaStream(stream.getTracks()),
        videoEnabled: isVideo ? true : existing.videoEnabled,
        audioEnabled: isAudio ? true : existing.audioEnabled,
      });
      this.notify();
    };

    pc.onconnectionstatechange = () => {
      const existing = this.peersMap.get(peerSocketId);
      if (existing) {
        this.peersMap.set(peerSocketId, {
          ...existing,
          connectionState: pc!.connectionState,
        });
        this.notify();
      }
    };

    this.peerConnections.set(peerSocketId, pc);
    this.peersMap.set(peerSocketId, {
      socketId: peerSocketId,
      ...peerInfo,
    });
    this.notify();

    return pc;
  }

  private attachRemoteAudioTrack(socketId: string, track: MediaStreamTrack) {
    if (typeof document === 'undefined') return;
    try {
      let audioEl = this.audioElements.get(socketId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.audioElements.set(socketId, audioEl);
      }
      const audioStream = this.createMediaStream([track]);
      if (audioEl.srcObject !== audioStream) {
        audioEl.srcObject = audioStream;
        audioEl.play().catch((err) => {
          console.warn('[MeetingSession] Remote audio playout notice:', err);
        });
      }
    } catch (err) {
      console.warn('[MeetingSession] Error attaching remote audio track:', err);
    }
  }

  private removeRemoteAudioTrack(socketId: string) {
    const audioEl = this.audioElements.get(socketId);
    if (audioEl) {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
      this.audioElements.delete(socketId);
    }
  }

  private async flushPendingCandidates(peerSocketId: string, pc: RTCPeerConnection) {
    const list = this.pendingCandidates.get(peerSocketId) || [];
    this.pendingCandidates.delete(peerSocketId);
    for (const c of list) {
      if (!c || !c.candidate) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn('[MeetingSession] Buffered ICE candidate error:', err);
      }
    }
  }

  // --- Socket Listener Setup & Teardown ---

  private bindSocketListeners() {
    this.handleExistingPeersBound = async ({ peers }: { peers: Array<any> }) => {
      for (const peer of peers) {
        if (!peer.socketId) continue;
        const pc = this.getOrCreatePeerConnection(peer.socketId, peer);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.getSocket().emit('webrtc_offer', {
            targetSocketId: peer.socketId,
            offer,
          });
        } catch (err) {
          console.error('[MeetingSession] Error creating offer to peer:', err);
        }
      }
    };

    this.handlePeerJoinedBound = ({ socketId, userId, username, fullName }: any) => {
      this.getOrCreatePeerConnection(socketId, { userId, username, fullName });
    };

    this.handleWebRTCOfferBound = async ({ senderSocketId, senderUserId, offer }: any) => {
      const pc = this.getOrCreatePeerConnection(senderSocketId, { userId: senderUserId });
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await this.flushPendingCandidates(senderSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.getSocket().emit('webrtc_answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (err) {
        console.error('[MeetingSession] Error handling offer:', err);
      }
    };

    this.handleWebRTCAnswerBound = async ({ senderSocketId, answer }: any) => {
      const pc = this.peerConnections.get(senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.flushPendingCandidates(senderSocketId, pc);
        } catch (err) {
          console.error('[MeetingSession] Error handling answer:', err);
        }
      }
    };

    this.handleICECandidateBound = async ({ senderSocketId, candidate }: any) => {
      if (!senderSocketId) return;
      if (!candidate || !candidate.candidate) return;
      const pc = this.peerConnections.get(senderSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[MeetingSession] ICE candidate error:', err);
        }
      } else {
        if (!this.pendingCandidates.has(senderSocketId)) {
          this.pendingCandidates.set(senderSocketId, []);
        }
        this.pendingCandidates.get(senderSocketId)!.push(candidate);
      }
    };

    this.handlePeerLeftBound = ({ socketId }: { socketId: string }) => {
      const pc = this.peerConnections.get(socketId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(socketId);
      }
      this.pendingCandidates.delete(socketId);
      this.removeRemoteAudioTrack(socketId);
      this.peersMap.delete(socketId);
      this.notify();
    };

    this.handleRoomMediaStateBound = (state: { activeScreenSharer: SharerInfo | null; activeWhiteboardSharer: SharerInfo | null }) => {
      this.activeScreenSharer = state.activeScreenSharer;
      this.activeWhiteboardSharer = state.activeWhiteboardSharer;
      this.notify();
    };

    this.handleScreenShareStartedBound = (sharer: SharerInfo) => {
      this.activeScreenSharer = sharer;
      this.notify();
    };

    this.handleScreenShareStoppedBound = () => {
      this.activeScreenSharer = null;
      this.notify();
    };

    this.handleWhiteboardShareStartedBound = (sharer: SharerInfo) => {
      this.activeWhiteboardSharer = sharer;
      this.notify();
    };

    this.handleWhiteboardShareStoppedBound = () => {
      this.activeWhiteboardSharer = null;
      this.notify();
    };

    this.handleUserMediaStateChangedBound = ({ socketId, videoEnabled, audioEnabled }: any) => {
      const existing = this.peersMap.get(socketId);
      if (existing) {
        this.peersMap.set(socketId, {
          ...existing,
          videoEnabled,
          audioEnabled,
        });
        this.notify();
      }
    };

    this.handleRoomParticipantsUpdatedBound = (data: { roomId: string; participantCount: number; participants: Participant[] }) => {
      if (data.roomId !== this.activeRoomId) return;
      this.participantCount = data.participantCount;
      this.authoritativeParticipants = data.participants;

      data.participants.forEach((p) => {
        if (p.socket_id && p.user_id !== this.currentUserId) {
          const existing = this.peersMap.get(p.socket_id) || { socketId: p.socket_id };
          this.peersMap.set(p.socket_id, {
            ...existing,
            userId: p.user_id,
            username: p.username,
            fullName: p.full_name,
            videoEnabled: p.video_enabled,
            audioEnabled: p.audio_enabled,
          });
        }
      });
      this.notify();
    };

    this.handleWhiteboardSnapshotBound = (data: { version: number; actions: WhiteboardStrokeAction[] }) => {
      this.whiteboardVersion = data.version || 0;
      this.whiteboardActions = data.actions || [];
      this.notify();
    };

    this.handleWhiteboardStrokeBound = (action: WhiteboardStrokeAction) => {
      this.whiteboardActions.push(action);
      if (action.sequenceNumber) {
        this.whiteboardVersion = action.sequenceNumber;
      }
      this.notify();
    };

    this.handleWhiteboardClearBound = (data: { sequenceNumber: number }) => {
      this.whiteboardActions = [];
      if (data?.sequenceNumber) {
        this.whiteboardVersion = data.sequenceNumber;
      }
      this.notify();
    };

    this.handleRoomEndedBound = ({ roomId }: { roomId: string }) => {
      if (roomId === this.activeRoomId) {
        this.transition({ type: 'ROOM_ENDED' });
        this.leave().catch(() => {});
      }
    };

    this.handleParticipantRemovedBound = ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (roomId === this.activeRoomId && userId === this.currentUserId) {
        this.leave().catch(() => {});
      }
    };

    this.handleRoomErrorBound = ({ error }: { error: string }) => {
      this.deviceError = error || 'Room error';
      this.notify();
    };
  }

  private registerSocketListeners() {
    if (this.isSocketListening) return;
    const socket = this.getSocket();
    if (!socket) return;

    socket.on('existing_peers', this.handleExistingPeersBound);
    socket.on('peer_joined', this.handlePeerJoinedBound);
    socket.on('webrtc_offer', this.handleWebRTCOfferBound);
    socket.on('webrtc_answer', this.handleWebRTCAnswerBound);
    socket.on('webrtc_ice_candidate', this.handleICECandidateBound);
    socket.on('peer_left', this.handlePeerLeftBound);
    socket.on('room_media_state', this.handleRoomMediaStateBound);
    socket.on('screen_share_started', this.handleScreenShareStartedBound);
    socket.on('screen_share_stopped', this.handleScreenShareStoppedBound);
    socket.on('whiteboard_share_started', this.handleWhiteboardShareStartedBound);
    socket.on('whiteboard_share_stopped', this.handleWhiteboardShareStoppedBound);
    socket.on('user_media_state_changed', this.handleUserMediaStateChangedBound);
    socket.on('room_participants_updated', this.handleRoomParticipantsUpdatedBound);
    socket.on('whiteboard_snapshot', this.handleWhiteboardSnapshotBound);
    socket.on('whiteboard_stroke', this.handleWhiteboardStrokeBound);
    socket.on('whiteboard_clear', this.handleWhiteboardClearBound);
    socket.on('room_ended', this.handleRoomEndedBound);
    socket.on('participant_removed', this.handleParticipantRemovedBound);
    socket.on('room_error', this.handleRoomErrorBound);

    this.isSocketListening = true;
  }

  private unregisterSocketListeners() {
    if (!this.isSocketListening) return;
    const socket = this.getSocket();
    if (!socket) return;

    socket.off('existing_peers', this.handleExistingPeersBound);
    socket.off('peer_joined', this.handlePeerJoinedBound);
    socket.off('webrtc_offer', this.handleWebRTCOfferBound);
    socket.off('webrtc_answer', this.handleWebRTCAnswerBound);
    socket.off('webrtc_ice_candidate', this.handleICECandidateBound);
    socket.off('peer_left', this.handlePeerLeftBound);
    socket.off('room_media_state', this.handleRoomMediaStateBound);
    socket.off('screen_share_started', this.handleScreenShareStartedBound);
    socket.off('screen_share_stopped', this.handleScreenShareStoppedBound);
    socket.off('whiteboard_share_started', this.handleWhiteboardShareStartedBound);
    socket.off('whiteboard_share_stopped', this.handleWhiteboardShareStoppedBound);
    socket.off('user_media_state_changed', this.handleUserMediaStateChangedBound);
    socket.off('room_participants_updated', this.handleRoomParticipantsUpdatedBound);
    socket.off('whiteboard_snapshot', this.handleWhiteboardSnapshotBound);
    socket.off('whiteboard_stroke', this.handleWhiteboardStrokeBound);
    socket.off('whiteboard_clear', this.handleWhiteboardClearBound);
    socket.off('room_ended', this.handleRoomEndedBound);
    socket.off('participant_removed', this.handleParticipantRemovedBound);
    socket.off('room_error', this.handleRoomErrorBound);

    this.isSocketListening = false;
  }

  // --- Public Lifecycle Methods ---

  /**
   * Joins a study room session.
   * Guarantees:
   * 1. Emits `join_study_room` exactly once per join.
   * 2. If already in or joining the same room, duplicate calls are ignored.
   * 3. Transitions state: idle -> joining -> full.
   */
  public async join(roomId: string, initialData?: any): Promise<void> {
    if (!roomId) return;

    // Duplicate join guard
    if (this.activeRoomId === roomId && (this.state === 'full' || this.state === 'joining' || this.state === 'dock' || this.state === 'pip')) {
      return;
    }

    // If active in another room, clean up previous meeting first
    if (this.activeRoomId && this.activeRoomId !== roomId) {
      await this.leave();
    }

    this.activeRoomId = roomId;
    if (initialData) {
      this.roomData = initialData;
    }

    this.transition({ type: 'JOIN_START' });

    // Register socket listeners once
    this.registerSocketListeners();

    // Emit join_study_room exactly once
    const socket = this.getSocket();
    socket.emit('join_study_room', { roomId });

    // Fetch initial room metadata
    try {
      const data = await this.makeApiRequest(`/rooms/${roomId}`);
      this.roomData = data;
    } catch {
      // Best-effort metadata fetch
    }

    this.transition({ type: 'JOIN_SUCCESS' });
  }

  /**
   * Transitions meeting to dock state (e.g. when user navigates away to another page).
   * WebRTC connections, media streams, and remote audio remain active in background.
   */
  public dock(): void {
    this.transition({ type: 'DOCK' });
  }

  /**
   * Restores meeting back to full state (when user navigates back to /rooms/:id).
   * Does NOT re-acquire getUserMedia, re-negotiate WebRTC, or re-join socket room.
   */
  public restore(): void {
    this.transition({ type: 'RESTORE_SUCCESS' });
  }

  /**
   * Transitions meeting to PiP state when external Document Picture-in-Picture window opens.
   */
  public openPip(): void {
    this.transition({ type: 'PIP' });
  }

  /**
   * Transitions meeting to dock state when PiP window is closed by user or system.
   * Closing PiP never leaves the room.
   */
  public closePip(): void {
    this.transition({ type: 'PIP_CLOSED' });
  }

  /**
   * Explicit leave:
   * 1. Stops local media & screen share tracks (hardware LEDs shut off).
   * 2. Closes all peer connections.
   * 3. Removes all socket listeners.
   * 4. Calls POST /api/rooms/:id/leave.
   * 5. Transitions state: ended -> idle.
   */
  public async leave(): Promise<void> {
    const roomId = this.activeRoomId;
    if (!roomId && this.state === 'idle') {
      return;
    }

    // Step 1: Transition to ended
    this.transition({ type: 'LEAVE' });

    // Step 2: REST leave notification
    if (roomId) {
      try {
        await this.makeApiRequest(`/rooms/${roomId}/leave`, { method: 'POST' });
      } catch {
        // Ignore API failures on leave
      }
      try {
        this.getSocket().emit('leave_study_room', { roomId });
      } catch {}
    }

    // Step 3: Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    // Step 4: Close all RTCPeerConnections
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    // Step 5: Clean up all remote audio elements
    this.audioElements.forEach((audioEl) => {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
    });
    this.audioElements.clear();

    // Step 6: Unregister all socket listeners
    this.unregisterSocketListeners();

    // Step 7: Reset state fields
    this.activeRoomId = null;
    this.roomData = null;
    this.peersMap.clear();
    this.authoritativeParticipants = [];
    this.participantCount = 1;
    this.activeScreenSharer = null;
    this.activeWhiteboardSharer = null;
    this.whiteboardActions = [];
    this.whiteboardVersion = 0;
    this.audioEnabled = false;
    this.videoEnabled = false;
    this.isSharingScreen = false;
    this.isHandRaised = false;
    this.deviceError = '';

    // Step 8: Transition from ended to idle
    this.transition({ type: 'RESET' });
  }

  /**
   * Host ends private study room session for all participants.
   */
  public async endRoom(): Promise<void> {
    if (!this.activeRoomId) return;
    const roomId = this.activeRoomId;
    try {
      await this.makeApiRequest(`/rooms/${roomId}/end`, { method: 'POST' });
    } catch {}
    await this.leave();
  }

  // --- Hardware Device Controls ---

  public async toggleCamera(): Promise<void> {
    this.deviceError = '';
    const mediaDevices = this.getMediaDevices();

    if (this.videoEnabled) {
      // Turn Camera OFF: STOP hardware track so camera LED turns off immediately
      const videoTrack = this.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        this.localStream?.removeTrack(videoTrack);
      }

      // Replace with null on all peer connections
      this.peerConnections.forEach((pc) => {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
        if (videoTransceiver) {
          videoTransceiver.sender.replaceTrack(null).catch(() => {});
        } else {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(null).catch(() => {});
          }
        }
      });

      if (this.localStream && this.localStream.getTracks().length === 0) {
        this.localStream = null;
      } else if (this.localStream) {
        this.localStream = this.createMediaStream(this.localStream.getTracks());
      }

      this.videoEnabled = false;
      if (this.activeRoomId) {
        this.getSocket().emit('user_media_state_changed', {
          roomId: this.activeRoomId,
          videoEnabled: false,
          audioEnabled: this.audioEnabled,
        });
      }
      this.notify();
    } else {
      // Turn Camera ON
      if (!mediaDevices?.getUserMedia) {
        this.deviceError = 'Camera not available';
        this.notify();
        return;
      }

      try {
        const newStream = await mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        const newTrack = newStream.getVideoTracks()[0];

        if (!this.localStream) {
          this.localStream = this.createMediaStream();
        }
        this.localStream.addTrack(newTrack);
        this.localStream = this.createMediaStream(this.localStream.getTracks());

        this.peerConnections.forEach((pc) => {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
          if (videoTransceiver) {
            videoTransceiver.sender.replaceTrack(newTrack).catch(() => {});
          } else {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video' || (!s.track && (s as any).kind === 'video'));
            if (videoSender) {
              videoSender.replaceTrack(newTrack).catch(() => {});
            } else if (pc.addTrack && this.localStream) {
              try { pc.addTrack(newTrack, this.localStream); } catch {}
            }
          }
        });

        this.videoEnabled = true;
        if (this.activeRoomId) {
          this.getSocket().emit('user_media_state_changed', {
            roomId: this.activeRoomId,
            videoEnabled: true,
            audioEnabled: this.audioEnabled,
          });
        }
        this.notify();
      } catch (err: any) {
        this.deviceError = 'Could not access camera. Please check permissions.';
        this.notify();
      }
    }
  }

  public async toggleMic(): Promise<void> {
    this.deviceError = '';
    const mediaDevices = this.getMediaDevices();

    if (this.audioEnabled) {
      // Turn Mic OFF: Stop hardware audio track
      const audioTrack = this.localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
        this.localStream?.removeTrack(audioTrack);
      }

      this.peerConnections.forEach((pc) => {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
        if (audioTransceiver) {
          audioTransceiver.sender.replaceTrack(null).catch(() => {});
        } else {
          const senders = pc.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(null).catch(() => {});
          }
        }
      });

      if (this.localStream && this.localStream.getTracks().length === 0) {
        this.localStream = null;
      } else if (this.localStream) {
        this.localStream = this.createMediaStream(this.localStream.getTracks());
      }

      this.audioEnabled = false;
      if (this.activeRoomId) {
        this.getSocket().emit('user_media_state_changed', {
          roomId: this.activeRoomId,
          videoEnabled: this.videoEnabled,
          audioEnabled: false,
        });
      }
      this.notify();
    } else {
      // Turn Mic ON
      if (!mediaDevices?.getUserMedia) {
        this.deviceError = 'Microphone not available';
        this.notify();
        return;
      }

      try {
        const audioConstraints = getAudioConstraints();
        const newStream = await mediaDevices.getUserMedia({ audio: audioConstraints });
        const newTrack = newStream.getAudioTracks()[0];

        const trackSettings = newTrack.getSettings ? newTrack.getSettings() : {};
        this.noiseSuppressionActive = trackSettings.noiseSuppression !== false && trackSettings.echoCancellation !== false;

        if (!this.localStream) {
          this.localStream = this.createMediaStream();
        }
        this.localStream.addTrack(newTrack);
        this.localStream = this.createMediaStream(this.localStream.getTracks());

        this.peerConnections.forEach((pc) => {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
          if (audioTransceiver) {
            audioTransceiver.sender.replaceTrack(newTrack).catch(() => {});
          } else {
            const senders = pc.getSenders();
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(newTrack).catch(() => {});
            } else if (pc.addTrack && this.localStream) {
              try { pc.addTrack(newTrack, this.localStream); } catch {}
            }
          }
        });

        this.audioEnabled = true;
        if (this.activeRoomId) {
          this.getSocket().emit('user_media_state_changed', {
            roomId: this.activeRoomId,
            videoEnabled: this.videoEnabled,
            audioEnabled: true,
          });
        }
        this.notify();
      } catch (err: any) {
        this.deviceError = 'Could not access microphone.';
        this.notify();
      }
    }
  }

  public async startScreenShare(): Promise<void> {
    if (this.isSharingScreen) {
      this.stopScreenShare();
      return;
    }

    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices?.getDisplayMedia) {
      return;
    }

    try {
      const stream = await mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      this.screenStream = stream;
      this.isSharingScreen = true;

      const screenVideoTrack = stream.getVideoTracks()[0];
      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.peerConnections.forEach((pc) => {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
        if (videoTransceiver) {
          videoTransceiver.sender.replaceTrack(screenVideoTrack).catch(() => {});
        } else {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video') || senders.find((s) => !s.track);
          if (videoSender) {
            videoSender.replaceTrack(screenVideoTrack).catch(() => {});
          } else if (pc.addTrack) {
            try { pc.addTrack(screenVideoTrack, stream); } catch {}
          }
        }
      });

      if (this.activeRoomId) {
        this.getSocket().emit('screen_share_started', { roomId: this.activeRoomId });
      }
      this.notify();
    } catch (err: any) {
      // User cancelled picker or error
    }
  }

  public stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    this.isSharingScreen = false;

    // Revert video track back to camera if active
    const cameraTrack = this.localStream?.getVideoTracks()[0] || null;
    this.peerConnections.forEach((pc) => {
      const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
      const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
      if (videoTransceiver) {
        videoTransceiver.sender.replaceTrack(cameraTrack).catch(() => {});
      } else {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video') || senders.find((s) => !s.track);
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack).catch(() => {});
        }
      }
    });

    if (this.activeRoomId) {
      this.getSocket().emit('screen_share_stopped', { roomId: this.activeRoomId });
    }
    this.notify();
  }

  public async toggleHand(): Promise<void> {
    if (!this.activeRoomId) return;
    try {
      await this.makeApiRequest(`/rooms/${this.activeRoomId}/hand`, { method: 'POST' });
      this.isHandRaised = !this.isHandRaised;
      this.notify();
    } catch {}
  }

  // --- Whiteboard Controls ---

  public setWhiteboardSharing(active: boolean): void {
    if (!this.activeRoomId) return;
    if (active) {
      this.getSocket().emit('whiteboard_share_started', { roomId: this.activeRoomId });
    } else {
      this.getSocket().emit('whiteboard_share_stopped', { roomId: this.activeRoomId });
    }
  }

  public addWhiteboardStroke(stroke: any): void {
    if (!this.activeRoomId) return;
    this.getSocket().emit('whiteboard_stroke', { roomId: this.activeRoomId, stroke });
  }

  public clearWhiteboard(): void {
    if (!this.activeRoomId) return;
    this.getSocket().emit('whiteboard_clear', { roomId: this.activeRoomId });
  }

  // --- UI Controls ---

  public setActiveView(view: 'video' | 'whiteboard'): void {
    this.activeView = view;
    this.notify();
  }

  public setShowParticipants(show: boolean | ((prev: boolean) => boolean)): void {
    this.showParticipants = typeof show === 'function' ? show(this.showParticipants) : show;
    this.notify();
  }

  public async refreshRoomData(): Promise<void> {
    if (!this.activeRoomId) return;
    try {
      const data = await this.makeApiRequest(`/rooms/${this.activeRoomId}`);
      this.roomData = data;
      this.notify();
    } catch {}
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this.handleUnloadBound) {
      window.removeEventListener('beforeunload', this.handleUnloadBound);
    }
    this.leave().catch(() => {});
  }
}
