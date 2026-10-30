import React, { useState, useEffect, useRef, useCallback } from 'react';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import { getSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Hand,
  Users,
  Volume2,
  MonitorUp,
  AlertCircle,
} from 'lucide-react';

interface Participant {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  is_hand_raised: number;
}

interface PeerInfo {
  socketId: string;
  userId?: string;
  username?: string;
  fullName?: string;
  stream?: MediaStream;
}

interface VideoMeetingProps {
  roomId: string;
  isHost: boolean;
  participants: Participant[];
  onToggleHand: () => void;
  onLeave: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Remote video tile with reliable callback ref + effect stream binding
const RemoteVideoTile: React.FC<{ peer: PeerInfo }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && peer.stream) {
      if (el.srcObject !== peer.stream) {
        el.srcObject = peer.stream;
      }
      el.play().catch((err) => {
        console.warn('Remote video play error:', err);
      });
    }
  };

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      if (videoRef.current.srcObject !== peer.stream) {
        videoRef.current.srcObject = peer.stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div
      className="card"
      style={{
        position: 'relative',
        backgroundColor: '#0F172A',
        border: '1px solid #CBD5E1',
        minHeight: '260px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        padding: 0,
        borderRadius: THEME.radius.card,
      }}
    >
      {peer.stream ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            minHeight: '260px',
            backgroundColor: '#0F172A',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: THEME.radius.full,
              backgroundColor: '#1E293B',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
              color: '#38BDF8',
            }}
          >
            {(peer.fullName || peer.username || 'S')[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>
            {peer.fullName || peer.username || 'Connecting peer...'}
          </span>
        </div>
      )}

      {/* Peer Label Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          backgroundColor: 'rgba(8, 11, 17, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '4px 10px',
          borderRadius: THEME.radius.pill,
          fontSize: '11.5px',
          fontWeight: 600,
          color: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Volume2 size={12} color="#0EA5E9" />
        <span>{peer.fullName || peer.username || 'Remote Student'}</span>
      </div>
    </div>
  );
};

export const VideoMeeting: React.FC<VideoMeetingProps> = ({
  roomId,
  isHost,
  participants,
  onToggleHand,
  onLeave,
}) => {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [peersMap, setPeersMap] = useState<Map<string, PeerInfo>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [deviceError, setDeviceError] = useState<string>('');

  // Update peer stream in state
  const updatePeerStream = useCallback((socketId: string, stream: MediaStream) => {
    setPeersMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(socketId) || { socketId };
      next.set(socketId, { ...existing, stream });
      return next;
    });
  }, []);

  // Create an RTCPeerConnection for a remote socket peer
  const createPeerConnection = useCallback((peerSocketId: string, peerInfo?: Partial<PeerInfo>): RTCPeerConnection => {
    if (peerConnections.current.has(peerSocketId)) {
      peerConnections.current.get(peerSocketId)?.close();
    }

    const socket = getSocket();
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Attach local audio/video tracks to peer connection
    const currentStream = isSharingScreen && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote track handler
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      updatePeerStream(peerSocketId, remoteStream);
    };

    // Store in refs and state
    peerConnections.current.set(peerSocketId, pc);
    setPeersMap((prev) => {
      const next = new Map(prev);
      const prevData = next.get(peerSocketId) || { socketId: peerSocketId };
      next.set(peerSocketId, { ...prevData, ...peerInfo });
      return next;
    });

    return pc;
  }, [isSharingScreen, updatePeerStream]);

  // Robust Media Stream initialization with fallbacks
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      let stream: MediaStream | null = null;
      try {
        // Preferred: video and audio
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });
      } catch (err: any) {
        console.warn('High quality constraints failed, attempting standard constraints:', err.message);
        try {
          // Standard constraints
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err2: any) {
          console.warn('Dual audio+video request failed, attempting separate device fallbacks:', err2.message);
          // Fallback 1: video only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setDeviceError('Microphone not detected or blocked. Video preview is active.');
          } catch (err3: any) {
            // Fallback 2: audio only
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              setDeviceError('Camera not detected or blocked. Audio channel is active.');
              setVideoEnabled(false);
            } catch (err4: any) {
              setDeviceError('Camera and microphone permissions not granted or devices offline. Please allow camera permissions in your browser.');
            }
          }
        }
      }

      if (!mounted) {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        return;
      }

      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;

        const hasVideo = stream.getVideoTracks().length > 0;
        setVideoEnabled(hasVideo);

        const hasAudio = stream.getAudioTracks().length > 0;
        setAudioEnabled(hasAudio);

        // Immediately attach tracks to any existing peer connections
        peerConnections.current.forEach((pc) => {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
        });
      }
    }

    if (navigator.mediaDevices?.getUserMedia) {
      initMedia();
    } else {
      setDeviceError('Media devices API is not supported in this browser environment.');
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Guarantee local video element binding whenever localStream or videoEnabled changes
  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) {
      if (el.srcObject !== localStreamRef.current) {
        el.srcObject = localStreamRef.current;
      }
      el.muted = true;
      el.play().catch((err) => {
        console.warn('Local preview autoplay notice:', err.message);
      });
    }
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, videoEnabled]);

  // Guarantee screen share video element binding
  const attachScreenVideo = useCallback((el: HTMLVideoElement | null) => {
    screenVideoRef.current = el;
    if (el && screenStreamRef.current) {
      if (el.srcObject !== screenStreamRef.current) {
        el.srcObject = screenStreamRef.current;
      }
      el.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      }
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isSharingScreen]);

  // WebRTC Socket.IO mesh signaling lifecycle
  useEffect(() => {
    const socket = getSocket();

    socket.emit('join_study_room', { roomId });

    // Handle existing peers when we join room -> initiate offers
    const handleExistingPeers = async ({ peers }: { peers: Array<{ socketId: string; userId?: string; username?: string; fullName?: string }> }) => {
      for (const peer of peers) {
        if (!peer.socketId) continue;
        const pc = createPeerConnection(peer.socketId, {
          userId: peer.userId,
          username: peer.username,
          fullName: peer.fullName,
        });

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetSocketId: peer.socketId,
            offer,
          });
        } catch (err) {
          console.error('[WebRTC] Failed to create offer for peer:', err);
        }
      }
    };

    // Handle newly joined peer -> record in state, wait for their offer
    const handlePeerJoined = ({ socketId, userId, username, fullName }: { socketId: string; userId?: string; username?: string; fullName?: string }) => {
      setPeersMap((prev) => {
        const next = new Map(prev);
        next.set(socketId, { socketId, userId, username, fullName });
        return next;
      });
    };

    // Handle incoming WebRTC offer
    const handleWebRTCOffer = async ({ senderSocketId, senderUserId, offer }: { senderSocketId: string; senderUserId?: string; offer: RTCSessionDescriptionInit }) => {
      let pc = peerConnections.current.get(senderSocketId);
      if (!pc) {
        pc = createPeerConnection(senderSocketId, { userId: senderUserId });
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
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

    // Handle incoming WebRTC answer
    const handleWebRTCAnswer = async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Error setting remote description from answer:', err);
        }
      }
    };

    // Handle incoming ICE candidate
    const handleICECandidate = async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      }
    };

    // Handle peer disconnected
    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }
      setPeersMap((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    socket.on('existing_peers', handleExistingPeers);
    socket.on('peer_joined', handlePeerJoined);
    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleICECandidate);
    socket.on('peer_left', handlePeerLeft);

    return () => {
      socket.emit('leave_study_room', { roomId });
      socket.off('existing_peers', handleExistingPeers);
      socket.off('peer_joined', handlePeerJoined);
      socket.off('webrtc_offer', handleWebRTCOffer);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleICECandidate);
      socket.off('peer_left', handlePeerLeft);

      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, createPeerConnection]);

  // Toggle or re-acquire microphone
  const toggleMic = async () => {
    const stream = localStreamRef.current;
    const existingAudioTrack = stream?.getAudioTracks()[0];

    if (existingAudioTrack) {
      existingAudioTrack.enabled = !existingAudioTrack.enabled;
      setAudioEnabled(existingAudioTrack.enabled);
    } else {
      // If mic was not available on start, try acquiring it now
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = newStream.getAudioTracks()[0];
        if (stream) {
          stream.addTrack(newTrack);
        } else {
          setLocalStream(newStream);
          localStreamRef.current = newStream;
        }
        setAudioEnabled(true);
        peerConnections.current.forEach((pc) => {
          pc.addTrack(newTrack, stream || newStream);
        });
      } catch (err: any) {
        console.warn('Microphone activation error:', err.message);
        setDeviceError('Microphone could not be accessed.');
      }
    }
  };

  // Toggle or re-acquire camera
  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    const existingVideoTrack = stream?.getVideoTracks()[0];

    if (existingVideoTrack) {
      existingVideoTrack.enabled = !existingVideoTrack.enabled;
      setVideoEnabled(existingVideoTrack.enabled);
    } else {
      // If camera was not available on start, try acquiring it now
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (stream) {
          stream.addTrack(newTrack);
          setLocalStream(new MediaStream(stream.getTracks()));
        } else {
          setLocalStream(newStream);
          localStreamRef.current = newStream;
        }
        setVideoEnabled(true);
        setDeviceError('');

        peerConnections.current.forEach((pc) => {
          pc.addTrack(newTrack, stream || newStream);
        });
      } catch (err: any) {
        console.warn('Camera activation error:', err.message);
        setDeviceError('Camera could not be accessed. Please ensure camera permissions are allowed.');
      }
    }
  };

  // Toggle screen share with dynamic track replacement
  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
      }
      setIsSharingScreen(false);

      // Revert video track on all peer connections to camera
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(camTrack).catch(console.error);
          }
        });
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsSharingScreen(true);

        const screenTrack = stream.getVideoTracks()[0];

        // Replace video track across all active peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack).catch(console.error);
          }
        });

        // Handle native browser stop button
        screenTrack.onended = () => {
          setIsSharingScreen(false);
          setScreenStream(null);
          screenStreamRef.current = null;

          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack) {
            peerConnections.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (sender) {
                sender.replaceTrack(camTrack).catch(console.error);
              }
            });
          }
        };
      } catch (err: any) {
        console.warn('Screen share cancelled or failed:', err.message);
      }
    }
  };

  const remotePeersList = Array.from(peersMap.values());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Device notice if camera/mic is offline */}
      {deviceError && (
        <div className="alert-box-vermilion" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} color={THEME.vermilion} />
          <div>
            <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[MEDIA NOTICE]</span> {deviceError}
          </div>
        </div>
      )}

      {/* Video Streams Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isSharingScreen ? '2fr 1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Screen Share Window */}
        {isSharingScreen && (
          <div
            className="card"
            style={{
              position: 'relative',
              backgroundColor: THEME.warmIvory,
              border: `2px solid ${THEME.emeraldGreen}`,
              minHeight: '360px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '10px',
              borderRadius: THEME.radius.card,
              boxShadow: THEME.shadow.lifted,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                borderBottom: `1.5px solid ${THEME.emeraldGreen}`,
                marginBottom: '8px',
              }}
            >
              <span className="badge">Screen Share Active</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                Presenting to Study Room
              </span>
            </div>
            <video
              ref={attachScreenVideo}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '480px',
                backgroundColor: THEME.deepForestCharcoal,
                borderRadius: THEME.radius.md,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Local Participant Tile */}
        <div
          className="card"
          style={{
            position: 'relative',
            backgroundColor: '#0F172A',
            border: `1.5px solid ${audioEnabled ? '#0284C7' : '#CBD5E1'}`,
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            padding: 0,
            borderRadius: THEME.radius.card,
            transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
          }}
        >
          {localStream && videoEnabled ? (
            <video
              ref={attachLocalVideo}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                minHeight: '260px',
                backgroundColor: '#0F172A',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror local camera
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(14, 165, 233, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#38BDF8',
                }}
              >
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC' }}>
                {localStream?.getVideoTracks().length ? 'Camera is paused' : 'Camera is offline'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                shape="pill"
                onClick={toggleCamera}
                leftIcon={<Video size={13} color="#F8FAFC" />}
              >
                Start Camera
              </Button>
            </div>
          )}

          {/* Local Label Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              backgroundColor: 'rgba(8, 11, 17, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '4px 10px',
              borderRadius: THEME.radius.pill,
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 2,
            }}
          >
            {audioEnabled ? (
              <Mic size={12} color="#10B981" />
            ) : (
              <MicOff size={12} color="#F43F5E" />
            )}
            <span>You {isHost ? '(Host)' : ''}</span>
          </div>
        </div>

        {/* Remote Peers Grid */}
        {remotePeersList.map((peer) => (
          <RemoteVideoTile key={peer.socketId} peer={peer} />
        ))}
      </div>

      {/* Control Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '14px 24px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
          flexWrap: 'wrap',
        }}
      >
        {/* Toggle Audio */}
        <Button
          variant={audioEnabled ? 'secondary' : 'vermilion'}
          shape="pill"
          onClick={toggleMic}
          leftIcon={
            audioEnabled ? (
              <Mic size={16} color="#0F172A" />
            ) : (
              <MicOff size={16} color="#FFFFFF" />
            )
          }
        >
          {audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
        </Button>

        {/* Toggle Video */}
        <Button
          variant={videoEnabled ? 'secondary' : 'vermilion'}
          shape="pill"
          onClick={toggleCamera}
          leftIcon={
            videoEnabled ? (
              <Video size={16} color="#F8FAFC" />
            ) : (
              <VideoOff size={16} color="#FFFFFF" />
            )
          }
        >
          {videoEnabled ? 'Stop Video' : 'Start Video'}
        </Button>

        {/* Toggle Screen Share */}
        <Button
          variant={isSharingScreen ? 'primary' : 'secondary'}
          shape="pill"
          onClick={toggleScreenShare}
          leftIcon={
            isSharingScreen ? (
              <MonitorUp size={16} color="#FFFFFF" />
            ) : (
              <ScreenShare size={16} color="#F8FAFC" />
            )
          }
        >
          {isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
        </Button>

        {/* Raise Hand */}
        <Button
          variant="secondary"
          shape="pill"
          onClick={onToggleHand}
          leftIcon={<Hand size={16} color="#F8FAFC" />}
        >
          Raise Hand
        </Button>

        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Leave Room */}
        <Button
          variant="vermilion"
          shape="pill"
          onClick={onLeave}
          leftIcon={<PhoneOff size={16} color="#FFFFFF" />}
        >
          Leave Call
        </Button>
      </div>
    </div>
  );
};

export default VideoMeeting;
