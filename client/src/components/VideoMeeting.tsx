import React, { useRef, useEffect, useState, useCallback } from 'react';
import { THEME } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useMeeting, PeerInfo, SharerInfo } from '../meeting/MeetingProvider';
import { Whiteboard } from './Whiteboard';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  ScreenShare,
  PenTool,
  Users,
  Hand,
  PhoneOff,
  AlertCircle,
  Volume2,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';

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

interface VideoMeetingProps {
  roomId: string;
  roomName: string;
  isHost: boolean;
  participants: Participant[];
  onInviteStudent: () => void;
  onToggleHand: () => void;
  onLeave: () => void;
  onEndRoom?: () => void;
}

// Remote video tile with accurate media lifecycle states
const RemoteVideoTile: React.FC<{ peer: PeerInfo }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState(false);

  const videoTrack = peer.stream?.getVideoTracks()[0];
  const hasLiveVideoTrack = Boolean(
    peer.stream &&
    videoTrack &&
    videoTrack.readyState === 'live' &&
    !videoTrack.muted &&
    !videoError
  );

  const isConnecting = peer.connectionState === 'connecting' || (peer.videoEnabled === true && !hasLiveVideoTrack && !videoError);
  const isFailed = peer.connectionState === 'failed';
  const isCameraOff = peer.videoEnabled === false;
  const isAudioOnly = peer.audioEnabled === true && isCameraOff;

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && peer.stream) {
      if (el.srcObject !== peer.stream) {
        el.srcObject = peer.stream;
      }
      el.play().catch((err) => {
        console.warn('[WebRTC] Remote video playback exception:', err);
      });
    }
  }, [peer.stream]);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      if (videoRef.current.srcObject !== peer.stream) {
        videoRef.current.srcObject = peer.stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream, hasLiveVideoTrack]);

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#0F172A',
        border: `1.5px solid ${peer.audioEnabled ? '#0284C7' : '#334155'}`,
        borderRadius: THEME.radius.card,
        height: '100%',
        minHeight: '220px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      {hasLiveVideoTrack && peer.videoEnabled !== false ? (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          onError={() => setVideoError(true)}
          onPlaying={() => setVideoError(false)}
          style={{
            width: '100%',
            height: '100%',
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
            gap: '10px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: THEME.radius.full,
              backgroundColor: '#1E293B',
              border: `2px solid ${peer.audioEnabled ? '#38BDF8' : 'rgba(148, 163, 184, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 800,
              color: '#38BDF8',
              boxShadow: peer.audioEnabled ? '0 0 16px rgba(56, 189, 248, 0.35)' : 'none',
              transition: 'box-shadow 0.2s ease',
            }}
          >
            {(peer.fullName || peer.username || 'S')[0]?.toUpperCase()}
          </div>

          <span style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
            {peer.fullName || peer.username || 'Remote Student'}
          </span>

          {/* Accurate Media Lifecycle Status Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isFailed ? (
              <span style={{ fontSize: '11px', color: '#F87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} />
                Connection interrupted
              </span>
            ) : isConnecting ? (
              <span style={{ fontSize: '11px', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Loader2 size={12} className="animate-spin" />
                Connecting video...
              </span>
            ) : isAudioOnly ? (
              <span style={{ fontSize: '11px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Volume2 size={12} />
                Audio Only
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <VideoOff size={12} />
                Camera Off
              </span>
            )}
          </div>
        </div>
      )}

      {/* Peer Label Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '3px 9px',
          borderRadius: THEME.radius.pill,
          fontSize: '11px',
          fontWeight: 700,
          color: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 2,
        }}
      >
        {peer.audioEnabled ? <Volume2 size={12} color="#10B981" /> : <MicOff size={12} color="#EF4444" />}
        <span>{peer.fullName || peer.username || 'Student'}</span>
      </div>
    </div>
  );
};

export const VideoMeeting: React.FC<VideoMeetingProps> = ({
  roomId,
  roomName,
  isHost,
  participants,
  onInviteStudent,
  onToggleHand,
  onLeave,
  onEndRoom,
}) => {
  const { user } = useAuth();
  const {
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
    deviceError,
    noiseSuppressionActive,
    activeView,
    showParticipants,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    setWhiteboardSharing,
    setActiveView,
    setShowParticipants,
    requestPictureInPicture,
    openDocumentPictureInPicture,
    isDocumentPipSupported,
    dockMeeting,
    state,
    restoreMeeting,
  } = useMeeting();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const presentationContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreenPresentation, setIsFullscreenPresentation] = useState(false);

  // Bind local camera preview
  useEffect(() => {
    if (localVideoRef.current) {
      if (videoEnabled && localStream && localStream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, videoEnabled]);

  // Bind screen share video
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
      }
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isSharingScreen]);

  // Fullscreen presentation handler
  const togglePresentationFullscreen = useCallback(() => {
    if (!presentationContainerRef.current) return;

    if (!document.fullscreenElement) {
      presentationContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreenPresentation(true);
      }).catch((err) => {
        console.warn('[Fullscreen] Presentation fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreenPresentation(false);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenPresentation(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update whiteboard sharing state when activeView changes
  const handleToggleView = (view: 'video' | 'whiteboard') => {
    setActiveView(view);
    setWhiteboardSharing(view === 'whiteboard');
  };

  const remotePeersList = Array.from(peersMap.values());
  const totalPeers = remotePeersList.length + 1; // local + remote

  // Dynamic layout grid configuration
  const getGridTemplate = () => {
    if (isSharingScreen) {
      return {
        columns: 'minmax(480px, 3.5fr) minmax(220px, 1fr)',
        rows: '1fr',
      };
    }
    if (totalPeers === 1) {
      return { columns: '1fr', rows: '1fr' };
    }
    if (totalPeers === 2) {
      return { columns: 'repeat(2, 1fr)', rows: '1fr' };
    }
    if (totalPeers <= 4) {
      return { columns: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)' };
    }
    return { columns: 'repeat(3, 1fr)', rows: 'repeat(2, 1fr)' };
  };

  if (state === 'dock') {
    return (
      <div
        className="card"
        style={{
          minHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          borderRadius: '16px',
          padding: '32px 24px',
          textAlign: 'center',
          gap: '16px',
          border: '1.5px solid #334155',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(2, 132, 199, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38BDF8',
          }}
        >
          <Maximize2 size={26} />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 6px' }}>
            Meeting Floating in Widget
          </h3>
          <p style={{ fontSize: '13.5px', color: '#94A3B8', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
            This study session is running inside the persistent floating meeting window. You can freely navigate StudySync or expand back to full room view.
          </p>
        </div>
        <button
          type="button"
          onClick={restoreMeeting}
          style={{
            padding: '10px 22px',
            borderRadius: THEME.radius.pill,
            backgroundColor: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Maximize2 size={15} />
          <span>Expand to Full Room</span>
        </button>
      </div>
    );
  }

  const gridStyle = getGridTemplate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: '78vh',
        position: 'relative',
        backgroundColor: '#020617',
        borderRadius: THEME.radius.cardLg,
        overflow: 'hidden',
        border: '1px solid #1E293B',
      }}
    >
      {/* Device Warning Notice */}
      {deviceError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#FCA5A5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={15} color="#F87171" />
          <span>{deviceError}</span>
        </div>
      )}

      {/* Main Collaborative Stage: Maximized & Filling Space */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '14px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {activeView === 'whiteboard' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', height: '100%' }}>
            {/* Whiteboard Top Strip with Video Thumbnails */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                backgroundColor: '#0F172A',
                borderRadius: THEME.radius.md,
                border: '1px solid #334155',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: 'rgba(2, 132, 199, 0.2)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#38BDF8',
                  whiteSpace: 'nowrap',
                }}
              >
                <PenTool size={13} color="#38BDF8" />
                Persistent Whiteboard
              </div>

              {activeWhiteboardSharer && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: THEME.radius.pill,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#34D399',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    className="live-pulse-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      display: 'inline-block',
                    }}
                  />
                  <span>
                    {activeWhiteboardSharer.userId === user?.id
                      ? 'You are drawing'
                      : `${activeWhiteboardSharer.username} is drawing`}
                  </span>
                </div>
              )}

              {/* Local Mini Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: '#1E293B',
                  fontSize: '11px',
                  color: '#E2E8F0',
                  whiteSpace: 'nowrap',
                }}
              >
                {audioEnabled ? <Mic size={11} color="#10B981" /> : <MicOff size={11} color="#EF4444" />}
                <span>You</span>
              </div>

              {/* Remote Peers Mini Badges */}
              {remotePeersList.map((p) => (
                <div
                  key={p.socketId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: THEME.radius.pill,
                    backgroundColor: '#1E293B',
                    fontSize: '11px',
                    color: '#E2E8F0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Volume2 size={11} color="#0EA5E9" />
                  <span>{p.fullName || p.username || 'Peer'}</span>
                </div>
              ))}
            </div>

            {/* Collaborative Whiteboard Canvas Container */}
            <div style={{ flex: 1, minHeight: '520px', borderRadius: THEME.radius.card, overflow: 'hidden' }}>
              <Whiteboard roomId={roomId} />
            </div>
          </div>
        ) : (
          /* Video & Screen Stage: Dynamic Adaptive Grid Filling Viewport */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridStyle.columns,
              gridTemplateRows: gridStyle.rows,
              gap: '12px',
              width: '100%',
              height: '100%',
              flex: 1,
            }}
          >
            {/* Active Screen Share Spotlight */}
            {isSharingScreen && (
              <div
                ref={presentationContainerRef}
                style={{
                  position: 'relative',
                  backgroundColor: '#000000',
                  border: '2px solid #0284C7',
                  borderRadius: THEME.radius.card,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    backgroundColor: '#0F172A',
                    borderBottom: '1px solid #1E293B',
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#38BDF8',
                    }}
                  >
                    <MonitorUp size={13} color="#38BDF8" />
                    You are presenting your screen
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Fullscreen presentation toggle */}
                    <button
                      type="button"
                      onClick={togglePresentationFullscreen}
                      style={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        color: '#F8FAFC',
                        padding: '4px 8px',
                        borderRadius: THEME.radius.pill,
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Fullscreen presentation"
                    >
                      {isFullscreenPresentation ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      <span>{isFullscreenPresentation ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopScreenShare}
                      style={{
                        backgroundColor: '#EF4444',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: THEME.radius.pill,
                        cursor: 'pointer',
                      }}
                    >
                      Stop Presenting
                    </button>
                  </div>
                </div>
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    flex: 1,
                    backgroundColor: '#000000',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
            )}

            {/* Local Video Tile */}
            <div
              style={{
                position: 'relative',
                backgroundColor: '#0F172A',
                border: `1.5px solid ${audioEnabled ? '#10B981' : '#334155'}`,
                borderRadius: THEME.radius.card,
                height: '100%',
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              {localStream && videoEnabled ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#0F172A',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirror local preview
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
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: THEME.radius.full,
                      backgroundColor: '#1E293B',
                      border: '2px solid rgba(2, 132, 199, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      fontWeight: 800,
                      color: '#38BDF8',
                    }}
                  >
                    {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
                    Camera is OFF
                  </span>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    style={{
                      backgroundColor: '#0284C7',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '6px 14px',
                      borderRadius: THEME.radius.pill,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Video size={13} />
                    Start Camera
                  </button>
                </div>
              )}

              {/* Local Label Badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '3px 9px',
                  borderRadius: THEME.radius.pill,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 2,
                }}
              >
                {audioEnabled ? <Mic size={12} color="#10B981" /> : <MicOff size={12} color="#EF4444" />}
                <span>You {isHost ? '(Host)' : ''}</span>
              </div>
            </div>

            {/* Remote Peer Video Tiles */}
            {remotePeersList.map((peer) => (
              <RemoteVideoTile key={peer.socketId} peer={peer} />
            ))}
          </div>
        )}
      </div>

      {/* Google Meet Bottom Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: '#0F172A',
          borderTop: '1px solid #1E293B',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 10,
        }}
      >
        {/* Left: Room Status & Noise Cancellation Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#F8FAFC' }}>
            {roomName}
          </span>
          {noiseSuppressionActive && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: THEME.radius.pill,
                fontSize: '11px',
                fontWeight: 700,
                color: '#34D399',
              }}
              title="Browser-level echo cancellation and noise suppression active on microphone"
            >
              <ShieldCheck size={11} color="#34D399" />
              Noise Suppression Active
            </span>
          )}
        </div>

        {/* Center: Essential Meeting Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 1. Microphone Toggle */}
          <button
            type="button"
            onClick={toggleMic}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: audioEnabled ? '#1E293B' : '#EF4444',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {audioEnabled ? <Mic size={18} color="#38BDF8" /> : <MicOff size={18} color="#FFFFFF" />}
          </button>

          {/* 2. Camera Toggle */}
          <button
            type="button"
            onClick={toggleCamera}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: videoEnabled ? '#1E293B' : '#EF4444',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {videoEnabled ? <Video size={18} color="#38BDF8" /> : <VideoOff size={18} color="#FFFFFF" />}
          </button>

          {/* 3. Screen Share */}
          <button
            type="button"
            onClick={startScreenShare}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isSharingScreen ? '#0284C7' : '#1E293B',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            title={isSharingScreen ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <ScreenShare size={18} color={isSharingScreen ? '#FFFFFF' : '#94A3B8'} />
          </button>

          {/* 4. Whiteboard Switcher */}
          <button
            type="button"
            onClick={() => handleToggleView(activeView === 'whiteboard' ? 'video' : 'whiteboard')}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: activeView === 'whiteboard' ? '#0284C7' : '#1E293B',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            title={activeView === 'whiteboard' ? 'Return to Video Grid' : 'Open Persistent Whiteboard'}
          >
            <PenTool size={18} color={activeView === 'whiteboard' ? '#FFFFFF' : '#94A3B8'} />
          </button>

          {/* 5. Raise Hand */}
          <button
            type="button"
            onClick={onToggleHand}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#1E293B',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            title="Raise / Lower Hand"
          >
            <Hand size={18} color="#FBBF24" />
          </button>

          {/* 6. Leave / Hang Up */}
          <button
            type="button"
            onClick={onLeave}
            style={{
              height: '44px',
              padding: '0 16px',
              borderRadius: THEME.radius.pill,
              border: 'none',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
            title="Leave Study Room"
          >
            <PhoneOff size={16} />
            <span>Leave</span>
          </button>

          {/* 7. End Room (Host Only) */}
          {isHost && onEndRoom && (
            <button
              type="button"
              onClick={onEndRoom}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: THEME.radius.pill,
                border: '1px solid #7F1D1D',
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                color: '#F87171',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
              title="End session for all participants"
            >
              End Room
            </button>
          )}
        </div>

        {/* Right: PiP & Participants Drawer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Minimize to Persistent Floating Window inside StudySync */}
          <button
            type="button"
            onClick={dockMeeting}
            aria-label="Minimize to Floating Window"
            title="Minimize to persistent floating meeting window"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: THEME.radius.pill,
              backgroundColor: '#1E293B',
              color: '#38BDF8',
              border: '1.5px solid #334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Minimize2 size={13} color="#38BDF8" />
            <span>Floating Window</span>
          </button>

          <button
            type="button"
            onClick={() => setShowParticipants((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: THEME.radius.pill,
              backgroundColor: showParticipants ? '#0284C7' : '#1E293B',
              border: '1px solid #334155',
              color: '#F8FAFC',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Users size={14} />
            <span>Participants ({authoritativeParticipants.length || participants.length || 1})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
