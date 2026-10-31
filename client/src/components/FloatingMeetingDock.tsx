import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  PhoneOff,
  MonitorUp,
  PenTool,
  Users,
  Volume2,
  ExternalLink,
} from 'lucide-react';

export const FloatingMeetingDock: React.FC = () => {
  const { user } = useAuth();
  const {
    activeRoomId,
    roomData,
    minimized,
    peersMap,
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    isSharingScreen,
    activeScreenSharer,
    activeWhiteboardSharer,
    participantCount,
    authoritativeParticipants,
    toggleCamera,
    toggleMic,
    leaveRoom,
    restoreMeeting,
    requestPictureInPicture,
  } = useMeeting();

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPipSupported(Boolean(document.pictureInPictureEnabled || ('documentPictureInPicture' in window)));
    }
  }, []);

  // Determine active visual stream
  const remotePeersArray = Array.from(peersMap.values());
  const peerWithVideo = remotePeersArray.find(
    (p) => p.stream && p.stream.getVideoTracks().length > 0 && p.videoEnabled !== false
  );

  const activeStream =
    (screenStream && screenStream.getVideoTracks().length > 0)
      ? screenStream
      : (peerWithVideo?.stream && peerWithVideo.stream.getVideoTracks().length > 0)
      ? peerWithVideo.stream
      : (videoEnabled && localStream && localStream.getVideoTracks().length > 0)
      ? localStream
      : null;

  const isLocalOnly = activeStream === localStream || activeStream === screenStream;

  // Bind video stream reliably
  useEffect(() => {
    if (previewVideoRef.current) {
      if (activeStream) {
        if (previewVideoRef.current.srcObject !== activeStream) {
          previewVideoRef.current.srcObject = activeStream;
        }
        previewVideoRef.current.play().catch((err) => {
          console.warn('[FloatingDock] Preview video playback notice:', err);
        });
      } else {
        previewVideoRef.current.srcObject = null;
      }
    }
  }, [activeStream]);

  // Handle native browser Picture-in-Picture
  const handleNativePiP = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewVideoRef.current && activeStream) {
      await requestPictureInPicture(previewVideoRef.current);
    }
  }, [activeStream, requestPictureInPicture]);

  // Only render when inside an active meeting AND navigated outside /rooms/:id
  if (!activeRoomId || !minimized) {
    return null;
  }

  const count = authoritativeParticipants.length || participantCount || (peersMap.size + 1);
  const roomName = roomData?.room?.name || 'Study Room';
  const displayPeer = peerWithVideo || remotePeersArray[0];

  return (
    <aside
      aria-label="Active Study Room Floating Dock"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '320px',
        backgroundColor: '#0F172A',
        borderRadius: '16px',
        border: '1px solid #334155',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        zIndex: 9999,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'studysync-slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1E293B',
          backgroundColor: '#0B1120',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
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
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#F8FAFC',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {roomName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginRight: '4px',
            }}
          >
            <Users size={12} />
            {count}
          </span>

          {/* Native Picture in Picture Button if stream active */}
          {pipSupported && activeStream && (
            <button
              type="button"
              onClick={handleNativePiP}
              title="Open browser Picture-in-Picture window"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '6px',
              }}
            >
              <ExternalLink size={14} />
            </button>
          )}

          {/* Expand to Full Room */}
          <button
            type="button"
            onClick={restoreMeeting}
            title="Expand to Full Meeting"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38BDF8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px',
            }}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Video Tile Preview Area (Never a Blank White Box) */}
      <div
        style={{
          position: 'relative',
          height: '160px',
          backgroundColor: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={restoreMeeting}
      >
        {activeStream ? (
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            muted={isLocalOnly}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              backgroundColor: '#020617',
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#94A3B8', padding: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: '#1E293B',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
                fontSize: '18px',
                fontWeight: 800,
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
              }}
            >
              {(displayPeer?.fullName || displayPeer?.username || user?.full_name || 'S')[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#E2E8F0', display: 'block' }}>
              {displayPeer?.fullName || displayPeer?.username || 'Study Session Active'}
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748B' }}>
              {audioEnabled || displayPeer?.audioEnabled ? 'Audio Active' : 'Meeting in progress'}
            </span>
          </div>
        )}

        {/* Live Presentation Indicators inside Mini Window */}
        {activeScreenSharer && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              backgroundColor: 'rgba(2, 132, 199, 0.92)',
              backdropFilter: 'blur(4px)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            <MonitorUp size={11} />
            <span>Screen: {activeScreenSharer.username}</span>
          </div>
        )}

        {activeWhiteboardSharer && (
          <div
            style={{
              position: 'absolute',
              top: activeScreenSharer ? '32px' : '8px',
              left: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.92)',
              backdropFilter: 'blur(4px)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            <PenTool size={11} />
            <span>Board: {activeWhiteboardSharer.username}</span>
          </div>
        )}

        {/* Hover hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            fontSize: '10px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.8)',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          Click to return
        </div>
      </div>

      {/* Control Buttons Dock */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          backgroundColor: '#0F172A',
        }}
      >
        {/* Toggle Mic */}
        <button
          type="button"
          onClick={toggleMic}
          title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: audioEnabled ? '#1E293B' : '#EF4444',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          {audioEnabled ? <Mic size={16} color="#38BDF8" /> : <MicOff size={16} color="#FFFFFF" />}
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={toggleCamera}
          title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: videoEnabled ? '#1E293B' : '#EF4444',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          {videoEnabled ? <Video size={16} color="#38BDF8" /> : <VideoOff size={16} color="#FFFFFF" />}
        </button>

        {/* Restore to Full Screen */}
        <button
          type="button"
          onClick={restoreMeeting}
          title="Return to Meeting"
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid #0284C7',
            backgroundColor: 'rgba(2, 132, 199, 0.2)',
            color: '#38BDF8',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Maximize2 size={13} />
          <span>Expand</span>
        </button>

        {/* Hang Up / Leave */}
        <button
          type="button"
          onClick={leaveRoom}
          title="Leave Study Room"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </aside>
  );
};
