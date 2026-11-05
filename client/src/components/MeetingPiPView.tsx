import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMeeting, PeerInfo } from '../meeting/MeetingProvider';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  PhoneOff,
  MonitorUp,
  ScreenShare,
  Users,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const MeetingPiPView: React.FC = () => {
  const { user } = useAuth();
  const {
    activeRoomId,
    state,
    roomData,
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    isSharingScreen,
    activeScreenSharer,
    peersMap,
    authoritativeParticipants,
    participantCount,
    toggleCamera,
    toggleMic,
    stopScreenShare,
    leaveRoom,
    restoreMeeting,
    closeDocumentPictureInPicture,
  } = useMeeting();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const localPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Responsive dimensions tracking for window resize
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 480,
    height: typeof window !== 'undefined' ? window.innerHeight : 440,
  });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      } else if (typeof window !== 'undefined') {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    if (containerRef.current && observer) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, []);

  // Determine active visual streams
  const remotePeersList = Array.from(peersMap.values());
  const peerWithVideo = remotePeersList.find(
    (p) => p.stream && p.stream.getVideoTracks().length > 0 && p.videoEnabled !== false
  );

  // Priority 1: Screen share (local or remote)
  // Priority 2: Remote peer with video
  // Priority 3: Local camera (if active)
  const isLocalScreenShare = isSharingScreen && Boolean(screenStream && screenStream.getVideoTracks().length > 0);
  const remoteSharerPeer = activeScreenSharer ? peersMap.get(activeScreenSharer.socketId) : null;

  const primaryStream = isLocalScreenShare
    ? screenStream
    : remoteSharerPeer?.stream && remoteSharerPeer.stream.getVideoTracks().length > 0
    ? remoteSharerPeer.stream
    : peerWithVideo?.stream && peerWithVideo.stream.getVideoTracks().length > 0
    ? peerWithVideo.stream
    : remotePeersList[0]?.stream && remotePeersList[0].stream.getVideoTracks().length > 0
    ? remotePeersList[0].stream
    : videoEnabled && localStream && localStream.getVideoTracks().length > 0
    ? localStream
    : null;

  const isPrimaryLocal = primaryStream === localStream || primaryStream === screenStream;
  const isPrimaryScreen = isLocalScreenShare || Boolean(activeScreenSharer && primaryStream === remoteSharerPeer?.stream);

  // Bind primary stream to main video element
  useEffect(() => {
    if (primaryVideoRef.current) {
      if (primaryStream) {
        if (primaryVideoRef.current.srcObject !== primaryStream) {
          primaryVideoRef.current.srcObject = primaryStream;
        }
        primaryVideoRef.current.play().catch((err) => {
          console.warn('[MeetingPiPView] Primary video play notice:', err);
        });
      } else {
        primaryVideoRef.current.srcObject = null;
      }
    }
  }, [primaryStream]);

  // Bind local stream to floating preview if primary stream is remote or screen-share
  const showLocalFloatingPreview = primaryStream !== localStream && (dimensions.width >= 340 && dimensions.height >= 280);

  useEffect(() => {
    if (localPreviewVideoRef.current) {
      if (videoEnabled && localStream && localStream.getVideoTracks().length > 0) {
        if (localPreviewVideoRef.current.srcObject !== localStream) {
          localPreviewVideoRef.current.srcObject = localStream;
        }
        localPreviewVideoRef.current.play().catch(() => {});
      } else {
        localPreviewVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, videoEnabled, showLocalFloatingPreview]);

  const handleRestore = useCallback(() => {
    closeDocumentPictureInPicture();
    try {
      window.focus();
    } catch {}
    restoreMeeting();
  }, [closeDocumentPictureInPicture, restoreMeeting]);

  const handleLeave = useCallback(async () => {
    closeDocumentPictureInPicture();
    await leaveRoom();
  }, [closeDocumentPictureInPicture, leaveRoom]);

  const roomName = roomData?.room?.name || 'Private Study Room';
  const inviteCode = roomData?.room?.invite_code || '';
  const count = authoritativeParticipants.length || participantCount || peersMap.size + 1;
  const isCompactHeight = dimensions.height < 360;
  const isCompactWidth = dimensions.width < 400;

  // Active presenter label
  const presenterLabel = isLocalScreenShare
    ? 'You are presenting'
    : activeScreenSharer
    ? `${activeScreenSharer.fullName || activeScreenSharer.username} presenting`
    : peerWithVideo
    ? peerWithVideo.fullName || peerWithVideo.username || 'Remote Student'
    : remotePeersList[0]
    ? remotePeersList[0].fullName || remotePeersList[0].username || 'Remote Student'
    : `${user?.full_name || 'You'} (You)`;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="StudySync External Picture-in-Picture Meeting"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0B1120',
        color: '#FFFFFF',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 1. Header Bar: Room Name, Code, Connection Status, Participant Count */}
      <header
        style={{
          padding: isCompactHeight ? '6px 10px' : '8px 12px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* Live Connection Indicator */}
          <span
            title="Connected to StudySync Meeting"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 8px #10B981',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: isCompactHeight ? '11.5px' : '12.5px',
              fontWeight: 700,
              color: '#F8FAFC',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isCompactWidth ? '140px' : '220px',
            }}
          >
            {roomName}
          </span>
          {inviteCode && !isCompactWidth && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#38BDF8',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '1px 6px',
                borderRadius: '9999px',
                flexShrink: 0,
              }}
            >
              {inviteCode}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Participant count */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#94A3B8',
              fontSize: '11px',
              fontWeight: 600,
            }}
            aria-label={`${count} participants`}
          >
            <Users size={12} />
            <span>{count}</span>
          </span>

          {/* Quick Restore Button */}
          <button
            type="button"
            onClick={handleRestore}
            aria-label="Restore full meeting window"
            title="Restore full meeting window"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38BDF8',
              cursor: 'pointer',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      {/* 2. Main Media Video Canvas */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {primaryStream ? (
          <video
            ref={primaryVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: isPrimaryScreen ? 'contain' : 'cover',
              transform: isPrimaryLocal && !isPrimaryScreen ? 'scaleX(-1)' : 'none',
              backgroundColor: '#020617',
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div
              style={{
                width: isCompactHeight ? '48px' : '64px',
                height: isCompactHeight ? '48px' : '64px',
                borderRadius: '50%',
                backgroundColor: '#1E293B',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isCompactHeight ? '18px' : '24px',
                fontWeight: 800,
                margin: '0 auto 8px auto',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
              }}
            >
              {(user?.full_name || user?.username || 'S')[0]?.toUpperCase()}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>
              Study Session Active
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              {audioEnabled ? 'Your microphone is live' : 'Microphone is muted'}
            </div>
          </div>
        )}

        {/* Presenter / Stream Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '3px 8px',
            borderRadius: '9999px',
            fontSize: '10.5px',
            color: '#F8FAFC',
            fontWeight: 600,
            maxWidth: '70%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          {isPrimaryScreen ? <MonitorUp size={11} color="#38BDF8" /> : null}
          <span>{presenterLabel}</span>
        </div>

        {/* Mic muted indicator on primary video */}
        {!audioEnabled && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              padding: '4px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
            title="Your microphone is muted"
          >
            <MicOff size={11} color="#FFFFFF" />
          </div>
        )}

        {/* 3. Small Local Preview (Corner picture-in-picture inside PiP) */}
        {showLocalFloatingPreview && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: isCompactWidth ? '80px' : '100px',
              height: isCompactWidth ? '52px' : '64px',
              backgroundColor: '#0F172A',
              borderRadius: '8px',
              border: '1.5px solid #334155',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {videoEnabled && localStream ? (
              <video
                ref={localPreviewVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#1E293B',
                    color: '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {(user?.full_name || 'Y')[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600 }}>You</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Controls Toolbar: Mic, Camera, Screen Share status/stop, Leave, Restore */}
      <footer
        style={{
          padding: isCompactHeight ? '6px 10px' : '8px 12px',
          backgroundColor: '#0F172A',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isCompactWidth ? '8px' : '10px',
          flexShrink: 0,
        }}
      >
        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={toggleMic}
          aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          style={{
            width: isCompactHeight ? '32px' : '36px',
            height: isCompactHeight ? '32px' : '36px',
            borderRadius: '50%',
            backgroundColor: audioEnabled ? '#1E293B' : '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            outline: 'none',
          }}
        >
          {audioEnabled ? <Mic size={15} color="#38BDF8" /> : <MicOff size={15} color="#FFFFFF" />}
        </button>

        {/* Camera Toggle Button */}
        <button
          type="button"
          onClick={toggleCamera}
          aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          style={{
            width: isCompactHeight ? '32px' : '36px',
            height: isCompactHeight ? '32px' : '36px',
            borderRadius: '50%',
            backgroundColor: videoEnabled ? '#1E293B' : '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            outline: 'none',
          }}
        >
          {videoEnabled ? <Video size={15} color="#38BDF8" /> : <VideoOff size={15} color="#FFFFFF" />}
        </button>

        {/* Screen Share Status / Stop Button */}
        {isSharingScreen && (
          <button
            type="button"
            onClick={stopScreenShare}
            aria-label="Stop screen sharing"
            title="Stop sharing your screen"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: isCompactHeight ? '5px 10px' : '6px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #EF4444',
              color: '#FCA5A5',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <ScreenShare size={13} color="#EF4444" />
            <span>Stop Share</span>
          </button>
        )}

        {/* Restore Full Meeting Button */}
        <button
          type="button"
          onClick={handleRestore}
          aria-label="Restore full meeting window"
          title="Restore full meeting in main window"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: isCompactHeight ? '5px 10px' : '6px 12px',
            borderRadius: '9999px',
            backgroundColor: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <Maximize2 size={13} />
          <span>Restore</span>
        </button>

        {/* Leave Meeting Button */}
        <button
          type="button"
          onClick={handleLeave}
          aria-label="Leave study room"
          title="Leave study room"
          style={{
            width: isCompactHeight ? '32px' : '36px',
            height: isCompactHeight ? '32px' : '36px',
            borderRadius: '50%',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <PhoneOff size={15} />
        </button>
      </footer>
    </div>
  );
};
