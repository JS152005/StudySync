import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../api/socket';
import { apiRequest } from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/ToastContext';

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

interface MeetingContextType {
  activeRoomId: string | null;
  roomData: any | null;
  minimized: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
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
  isHost: boolean;
  joinRoom: (roomId: string, initialData?: any) => Promise<void>;
  leaveRoom: () => Promise<void>;
  endRoom: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  setWhiteboardSharing: (active: boolean) => void;
  addWhiteboardStroke: (stroke: any) => void;
  clearWhiteboard: () => void;
  setActiveView: (view: 'video' | 'whiteboard') => void;
  setShowParticipants: (show: boolean | ((prev: boolean) => boolean)) => void;
  setMinimized: (min: boolean) => void;
  restoreMeeting: () => void;
  refreshRoomData: () => Promise<void>;
  requestPictureInPicture: (videoEl: HTMLVideoElement | null) => Promise<void>;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const getSupportedAudioConstraints = (): MediaTrackConstraints => {
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
};

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any | null>(null);
  const [minimized, setMinimized] = useState<boolean>(false);

  // Hardware state: MUST BE OFF BY DEFAULT ON RELOAD/JOIN
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(false);
  const [isSharingScreen, setIsSharingScreen] = useState<boolean>(false);

  const [activeScreenSharer, setActiveScreenSharer] = useState<SharerInfo | null>(null);
  const [activeWhiteboardSharer, setActiveWhiteboardSharer] = useState<SharerInfo | null>(null);

  const [peersMap, setPeersMap] = useState<Map<string, PeerInfo>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Authoritative unique participants list & count from server
  const [authoritativeParticipants, setAuthoritativeParticipants] = useState<Participant[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(1);

  // Room-persistent whiteboard actions
  const [whiteboardActions, setWhiteboardActions] = useState<WhiteboardStrokeAction[]>([]);
  const [whiteboardVersion, setWhiteboardVersion] = useState<number>(0);

  const [deviceError, setDeviceError] = useState<string>('');
  const [noiseSuppressionActive, setNoiseSuppressionActive] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'video' | 'whiteboard'>('video');
  const [showParticipants, setShowParticipants] = useState<boolean>(false);

  // Sync minimized state based on route
  useEffect(() => {
    if (!activeRoomId) {
      setMinimized(false);
      return;
    }
    const inMeetingRoute = location.pathname.startsWith(`/rooms/${activeRoomId}`);
    setMinimized(!inMeetingRoute);
  }, [location.pathname, activeRoomId]);

  const updatePeerStream = useCallback((socketId: string, stream: MediaStream) => {
    setPeersMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(socketId) || { socketId };
      next.set(socketId, { ...existing, stream });
      return next;
    });
  }, []);

  const updatePeerInfo = useCallback((socketId: string, info: Partial<PeerInfo>) => {
    setPeersMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(socketId) || { socketId };
      next.set(socketId, { ...existing, ...info });
      return next;
    });
  }, []);

  // Create or retrieve PeerConnection for a socket peer with pre-allocated transceivers
  const getOrCreatePeerConnection = useCallback((peerSocketId: string, peerInfo?: Partial<PeerInfo>): RTCPeerConnection => {
    let pc = peerConnections.current.get(peerSocketId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    const socket = getSocket();

    // Add audio and video transceivers upfront so m= lines exist during initial SDP negotiation
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch {
      // Fallback for environments lacking full transceiver support
    }

    // Attach local active tracks to transceivers or addTrack
    const currentAudioTrack = localStreamRef.current?.getAudioTracks()[0] || null;
    const currentVideoTrack = screenStreamRef.current?.getVideoTracks()[0] || localStreamRef.current?.getVideoTracks()[0] || null;

    const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
    const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');

    if (audioTransceiver && currentAudioTrack) {
      audioTransceiver.sender.replaceTrack(currentAudioTrack).catch(() => {});
    } else if (currentAudioTrack && localStreamRef.current) {
      try { pc.addTrack(currentAudioTrack, localStreamRef.current); } catch {}
    }

    if (videoTransceiver && currentVideoTrack) {
      videoTransceiver.sender.replaceTrack(currentVideoTrack).catch(() => {});
    } else if (currentVideoTrack && (screenStreamRef.current || localStreamRef.current)) {
      try { pc.addTrack(currentVideoTrack, (screenStreamRef.current || localStreamRef.current)!); } catch {}
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
      setPeersMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerSocketId) || { socketId: peerSocketId };
        let stream = existing.stream;
        if (!stream) {
          stream = event.streams[0] || new MediaStream();
        }
        if (!stream.getTracks().some((t) => t.id === track.id)) {
          stream.addTrack(track);
        }

        // Listen for track activity changes
        track.onmute = () => {
          updatePeerInfo(peerSocketId, {});
        };
        track.onunmute = () => {
          updatePeerInfo(peerSocketId, {});
        };
        track.onended = () => {
          updatePeerInfo(peerSocketId, {});
        };

        const isVideo = track.kind === 'video';
        const isAudio = track.kind === 'audio';

        next.set(peerSocketId, {
          ...existing,
          stream: new MediaStream(stream.getTracks()),
          videoEnabled: isVideo ? true : existing.videoEnabled,
          audioEnabled: isAudio ? true : existing.audioEnabled,
        });
        return next;
      });
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      updatePeerInfo(peerSocketId, { connectionState: pc!.connectionState });
    };

    peerConnections.current.set(peerSocketId, pc);
    updatePeerInfo(peerSocketId, { socketId: peerSocketId, ...peerInfo });

    return pc;
  }, [updatePeerInfo]);

  // Flush buffered ICE candidates after setRemoteDescription
  const flushPendingCandidates = async (peerSocketId: string, pc: RTCPeerConnection) => {
    const list = pendingCandidates.current.get(peerSocketId) || [];
    for (const c of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
      }
    }
    pendingCandidates.current.delete(peerSocketId);
  };

  // Join Room
  const joinRoom = useCallback(async (roomId: string, initialData?: any) => {
    if (activeRoomId === roomId) {
      return; // Already joined this room
    }

    setActiveRoomId(roomId);
    if (initialData) {
      setRoomData(initialData);
    }

    const socket = getSocket();
    socket.emit('join_study_room', { roomId });

    try {
      const data = await apiRequest(`/rooms/${roomId}`);
      setRoomData(data);
    } catch {
      // ignore
    }
  }, [activeRoomId]);

  // Refresh Room Metadata
  const refreshRoomData = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const data = await apiRequest(`/rooms/${activeRoomId}`);
      setRoomData(data);
    } catch {
      // ignore
    }
  }, [activeRoomId]);

  // Explicit Leave Room (User clicked Leave Room)
  const leaveRoom = useCallback(async () => {
    if (!activeRoomId) return;
    const roomId = activeRoomId;

    try {
      await apiRequest(`/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // ignore
    }

    const socket = getSocket();
    socket.emit('leave_study_room', { roomId });

    // Stop and release local tracks so physical hardware LEDs shut off
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();

    setPeersMap(new Map());
    setAuthoritativeParticipants([]);
    setParticipantCount(1);
    setActiveScreenSharer(null);
    setActiveWhiteboardSharer(null);
    setVideoEnabled(false);
    setAudioEnabled(false);
    setIsSharingScreen(false);
    setActiveRoomId(null);
    setRoomData(null);
    setMinimized(false);

    toast.info('Left study room');
    navigate('/rooms');
  }, [activeRoomId, navigate, toast]);

  // Host End Room
  const endRoom = useCallback(async () => {
    if (!activeRoomId) return;
    const roomId = activeRoomId;
    try {
      await apiRequest(`/rooms/${roomId}/end`, { method: 'POST' });
    } catch {
      // ignore
    }
    await leaveRoom();
  }, [activeRoomId, leaveRoom]);

  // Return to Full Meeting
  const restoreMeeting = useCallback(() => {
    if (activeRoomId) {
      setMinimized(false);
      navigate(`/rooms/${activeRoomId}`);
    }
  }, [activeRoomId, navigate]);

  // Camera Toggle: OFF stops hardware track, ON acquires stream and replaces tracks
  const toggleCamera = useCallback(async () => {
    setDeviceError('');

    if (videoEnabled) {
      // Turn Camera OFF: STOP hardware track so indicator light turns off immediately
      const stream = localStreamRef.current;
      const videoTrack = stream?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        stream?.removeTrack(videoTrack);
      }

      // Update all peer connections with null video track
      peerConnections.current.forEach((pc) => {
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

      if (stream && stream.getTracks().length === 0) {
        localStreamRef.current = null;
        setLocalStream(null);
      } else if (stream) {
        setLocalStream(new MediaStream(stream.getTracks()));
      }

      setVideoEnabled(false);
      if (activeRoomId) {
        getSocket().emit('user_media_state_changed', {
          roomId: activeRoomId,
          videoEnabled: false,
          audioEnabled,
        });
      }
    } else {
      // Turn Camera ON: Request camera stream & replace track on peer connections
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        const newTrack = newStream.getVideoTracks()[0];

        let current = localStreamRef.current;
        if (!current) {
          current = new MediaStream();
          localStreamRef.current = current;
        }
        current.addTrack(newTrack);
        setLocalStream(new MediaStream(current.getTracks()));

        // Replace track on existing peer senders or transceivers
        peerConnections.current.forEach((pc) => {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
          if (videoTransceiver) {
            videoTransceiver.sender.replaceTrack(newTrack).catch(() => {});
          } else {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video' || (!s.track && (s as any).kind === 'video'));
            if (videoSender) {
              videoSender.replaceTrack(newTrack).catch(() => {});
            } else {
              try { pc.addTrack(newTrack, current!); } catch {}
            }
          }
        });

        setVideoEnabled(true);
        if (activeRoomId) {
          getSocket().emit('user_media_state_changed', {
            roomId: activeRoomId,
            videoEnabled: true,
            audioEnabled,
          });
        }
      } catch (err: any) {
        console.error('[WebRTC] Camera error:', err);
        setDeviceError('Could not access camera. Please check camera device permissions.');
        toast.error('Camera could not be accessed. Check permissions.');
      }
    }
  }, [videoEnabled, activeRoomId, audioEnabled, toast]);

  // Microphone Toggle: OFF stops hardware track, ON acquires stream and replaces tracks
  const toggleMic = useCallback(async () => {
    setDeviceError('');

    if (audioEnabled) {
      // Turn Mic OFF: Stop hardware audio track
      const stream = localStreamRef.current;
      const audioTrack = stream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
        stream?.removeTrack(audioTrack);
      }

      peerConnections.current.forEach((pc) => {
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

      if (stream && stream.getTracks().length === 0) {
        localStreamRef.current = null;
        setLocalStream(null);
      } else if (stream) {
        setLocalStream(new MediaStream(stream.getTracks()));
      }

      setAudioEnabled(false);
      if (activeRoomId) {
        getSocket().emit('user_media_state_changed', {
          roomId: activeRoomId,
          videoEnabled,
          audioEnabled: false,
        });
      }
    } else {
      // Turn Mic ON: Request mic with audio constraints
      try {
        const audioConstraints = getSupportedAudioConstraints();
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        const newTrack = newStream.getAudioTracks()[0];

        // Check active audio constraint support
        const trackSettings = newTrack.getSettings ? newTrack.getSettings() : {};
        setNoiseSuppressionActive(trackSettings.noiseSuppression !== false && trackSettings.echoCancellation !== false);

        let current = localStreamRef.current;
        if (!current) {
          current = new MediaStream();
          localStreamRef.current = current;
        }
        current.addTrack(newTrack);
        setLocalStream(new MediaStream(current.getTracks()));

        peerConnections.current.forEach((pc) => {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
          if (audioTransceiver) {
            audioTransceiver.sender.replaceTrack(newTrack).catch(() => {});
          } else {
            const senders = pc.getSenders();
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(newTrack).catch(() => {});
            } else {
              try { pc.addTrack(newTrack, current!); } catch {}
            }
          }
        });

        setAudioEnabled(true);
        if (activeRoomId) {
          getSocket().emit('user_media_state_changed', {
            roomId: activeRoomId,
            videoEnabled,
            audioEnabled: true,
          });
        }
      } catch (err: any) {
        console.error('[WebRTC] Microphone error:', err);
        setDeviceError('Could not access microphone.');
        toast.error('Microphone could not be accessed.');
      }
    }
  }, [audioEnabled, activeRoomId, videoEnabled, toast]);

  // Screen Sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    setIsSharingScreen(false);

    // Revert video track back to camera if active
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    peerConnections.current.forEach((pc) => {
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

    if (activeRoomId) {
      getSocket().emit('screen_share_stopped', { roomId: activeRoomId });
    }
  }, [activeRoomId]);

  const startScreenShare = useCallback(async () => {
    if (isSharingScreen) {
      stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharingScreen(true);

      const screenVideoTrack = stream.getVideoTracks()[0];
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      // Replace peer senders or transceivers with screen track
      peerConnections.current.forEach((pc) => {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
        if (videoTransceiver) {
          videoTransceiver.sender.replaceTrack(screenVideoTrack).catch(() => {});
        } else {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video') || senders.find((s) => !s.track);
          if (videoSender) {
            videoSender.replaceTrack(screenVideoTrack).catch(() => {});
          } else {
            try { pc.addTrack(screenVideoTrack, stream); } catch {}
          }
        }
      });

      if (activeRoomId) {
        getSocket().emit('screen_share_started', { roomId: activeRoomId });
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        toast.error('Failed to initiate screen share.');
      }
    }
  }, [isSharingScreen, stopScreenShare, activeRoomId, toast]);

  // Whiteboard Sharing Broadcaster
  const setWhiteboardSharing = useCallback((active: boolean) => {
    if (!activeRoomId) return;
    const socket = getSocket();
    if (active) {
      socket.emit('whiteboard_share_started', { roomId: activeRoomId });
    } else {
      socket.emit('whiteboard_share_stopped', { roomId: activeRoomId });
    }
  }, [activeRoomId]);

  // Send stroke to backend & append locally
  const addWhiteboardStroke = useCallback((stroke: any) => {
    if (!activeRoomId) return;
    const socket = getSocket();
    socket.emit('whiteboard_stroke', { roomId: activeRoomId, stroke });
  }, [activeRoomId]);

  // Clear whiteboard for all participants
  const clearWhiteboard = useCallback(() => {
    if (!activeRoomId) return;
    const socket = getSocket();
    socket.emit('whiteboard_clear', { roomId: activeRoomId });
  }, [activeRoomId]);

  // Picture in Picture (Native Video PiP or Document PiP)
  const requestPictureInPicture = useCallback(async (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoEl.requestPictureInPicture) {
        await videoEl.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[PiP] Picture-in-picture notice:', err);
    }
  }, []);

  // Socket Events Setup for WebRTC, Indicators & Authoritative Room State
  useEffect(() => {
    if (!activeRoomId) return;
    const socket = getSocket();

    const handleExistingPeers = async ({ peers }: { peers: Array<{ socketId: string; userId?: string; username?: string; fullName?: string; videoEnabled?: boolean; audioEnabled?: boolean }> }) => {
      for (const peer of peers) {
        if (!peer.socketId) continue;
        const pc = getOrCreatePeerConnection(peer.socketId, peer);

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetSocketId: peer.socketId,
            offer,
          });
        } catch (err) {
          console.error('[WebRTC] Error initiating offer to existing peer:', err);
        }
      }
    };

    const handlePeerJoined = ({ socketId, userId, username, fullName }: { socketId: string; userId?: string; username?: string; fullName?: string }) => {
      getOrCreatePeerConnection(socketId, { userId, username, fullName });
    };

    const handleWebRTCOffer = async ({ senderSocketId, senderUserId, offer }: { senderSocketId: string; senderUserId?: string; offer: RTCSessionDescriptionInit }) => {
      const pc = getOrCreatePeerConnection(senderSocketId, { userId: senderUserId });
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingCandidates(senderSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    };

    const handleWebRTCAnswer = async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushPendingCandidates(senderSocketId, pc);
        } catch (err) {
          console.error('[WebRTC] Error handling answer:', err);
        }
      }
    };

    const handleICECandidate = async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] ICE candidate error:', err);
        }
      } else {
        if (!pendingCandidates.current.has(senderSocketId)) {
          pendingCandidates.current.set(senderSocketId, []);
        }
        pendingCandidates.current.get(senderSocketId)!.push(candidate);
      }
    };

    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }
      pendingCandidates.current.delete(socketId);
      setPeersMap((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    const handleRoomMediaState = (state: { activeScreenSharer: SharerInfo | null; activeWhiteboardSharer: SharerInfo | null }) => {
      setActiveScreenSharer(state.activeScreenSharer);
      setActiveWhiteboardSharer(state.activeWhiteboardSharer);
    };

    const handleScreenShareStarted = (sharer: SharerInfo) => {
      setActiveScreenSharer(sharer);
      if (sharer.userId !== user?.id) {
        toast.info(`${sharer.fullName || sharer.username} started screen sharing`);
      }
    };

    const handleScreenShareStopped = () => {
      setActiveScreenSharer(null);
    };

    const handleWhiteboardShareStarted = (sharer: SharerInfo) => {
      setActiveWhiteboardSharer(sharer);
      if (sharer.userId !== user?.id) {
        toast.info(`${sharer.fullName || sharer.username} is using the live whiteboard`);
      }
    };

    const handleWhiteboardShareStopped = () => {
      setActiveWhiteboardSharer(null);
    };

    const handleUserMediaStateChanged = ({ socketId, videoEnabled, audioEnabled }: { socketId: string; videoEnabled: boolean; audioEnabled: boolean }) => {
      updatePeerInfo(socketId, { videoEnabled, audioEnabled });
    };

    // Authoritative participants snapshot from server
    const handleRoomParticipantsUpdated = (data: { roomId: string; participantCount: number; participants: Participant[] }) => {
      if (data.roomId !== activeRoomId) return;
      setParticipantCount(data.participantCount);
      setAuthoritativeParticipants(data.participants);

      // Synchronize videoEnabled / audioEnabled to existing peers in map
      data.participants.forEach((p) => {
        if (p.socket_id && p.user_id !== user?.id) {
          updatePeerInfo(p.socket_id, {
            userId: p.user_id,
            username: p.username,
            fullName: p.full_name,
            videoEnabled: p.video_enabled,
            audioEnabled: p.audio_enabled,
          });
        }
      });
    };

    // Whiteboard history & synchronization
    const handleWhiteboardSnapshot = (data: { version: number; actions: WhiteboardStrokeAction[] }) => {
      setWhiteboardVersion(data.version || 0);
      setWhiteboardActions(data.actions || []);
    };

    const handleWhiteboardStroke = (action: WhiteboardStrokeAction) => {
      setWhiteboardActions((prev) => [...prev, action]);
      if (action.sequenceNumber) {
        setWhiteboardVersion(action.sequenceNumber);
      }
    };

    const handleWhiteboardClear = (data: { sequenceNumber: number }) => {
      setWhiteboardActions([]);
      if (data?.sequenceNumber) {
        setWhiteboardVersion(data.sequenceNumber);
      }
    };

    socket.on('existing_peers', handleExistingPeers);
    socket.on('peer_joined', handlePeerJoined);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleICECandidate);
    socket.on('peer_left', handlePeerLeft);
    socket.on('room_media_state', handleRoomMediaState);
    socket.on('screen_share_started', handleScreenShareStarted);
    socket.on('screen_share_stopped', handleScreenShareStopped);
    socket.on('whiteboard_share_started', handleWhiteboardShareStarted);
    socket.on('whiteboard_share_stopped', handleWhiteboardShareStopped);
    socket.on('user_media_state_changed', handleUserMediaStateChanged);
    socket.on('room_participants_updated', handleRoomParticipantsUpdated);
    socket.on('whiteboard_snapshot', handleWhiteboardSnapshot);
    socket.on('whiteboard_stroke', handleWhiteboardStroke);
    socket.on('whiteboard_clear', handleWhiteboardClear);

    return () => {
      socket.off('existing_peers', handleExistingPeers);
      socket.off('peer_joined', handlePeerJoined);
      socket.off('webrtc_offer', handleWebRTCOffer);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleICECandidate);
      socket.off('peer_left', handlePeerLeft);
      socket.off('room_media_state', handleRoomMediaState);
      socket.off('screen_share_started', handleScreenShareStarted);
      socket.off('screen_share_stopped', handleScreenShareStopped);
      socket.off('whiteboard_share_started', handleWhiteboardShareStarted);
      socket.off('whiteboard_share_stopped', handleWhiteboardShareStopped);
      socket.off('user_media_state_changed', handleUserMediaStateChanged);
      socket.off('room_participants_updated', handleRoomParticipantsUpdated);
      socket.off('whiteboard_snapshot', handleWhiteboardSnapshot);
      socket.off('whiteboard_stroke', handleWhiteboardStroke);
      socket.off('whiteboard_clear', handleWhiteboardClear);
    };
  }, [activeRoomId, getOrCreatePeerConnection, updatePeerInfo, user?.id, toast]);

  const isHost = Boolean(roomData?.room?.host_id && user?.id && roomData.room.host_id === user.id);

  return (
    <MeetingContext.Provider
      value={{
        activeRoomId,
        roomData,
        minimized,
        localStream,
        screenStream,
        audioEnabled,
        videoEnabled,
        isSharingScreen,
        activeScreenSharer,
        activeWhiteboardSharer,
        peersMap,
        authoritativeParticipants,
        participantCount,
        whiteboardActions,
        whiteboardVersion,
        deviceError,
        noiseSuppressionActive,
        activeView,
        showParticipants,
        isHost,
        joinRoom,
        leaveRoom,
        endRoom,
        toggleCamera,
        toggleMic,
        startScreenShare,
        stopScreenShare,
        setWhiteboardSharing,
        addWhiteboardStroke,
        clearWhiteboard,
        setActiveView,
        setShowParticipants,
        setMinimized,
        restoreMeeting,
        refreshRoomData,
        requestPictureInPicture,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = (): MeetingContextType => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};
