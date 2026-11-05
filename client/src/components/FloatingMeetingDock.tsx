import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMeeting } from '../meeting/MeetingProvider';
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
  ChevronDown,
  ChevronUp,
  GripHorizontal,
} from 'lucide-react';

export type DockSize = 'compact' | 'normal' | 'expanded';

const DOCK_DIMENSIONS: Record<DockSize, { width: number; height: number }> = {
  compact: { width: 260, height: 185 },
  normal: { width: 340, height: 245 },
  expanded: { width: 440, height: 320 },
};

export const FloatingMeetingDock: React.FC = () => {
  const { user } = useAuth();
  const {
    activeRoomId,
    state,
    roomData,
    peersMap,
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    activeScreenSharer,
    activeWhiteboardSharer,
    participantCount,
    authoritativeParticipants,
    toggleCamera,
    toggleMic,
    leaveRoom,
    restoreMeeting,
  } = useMeeting();

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);

  // Floating dock modes
  const [dockSize, setDockSize] = useState<DockSize>('normal');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Position and dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Calculate current dimensions
  const dims = DOCK_DIMENSIONS[dockSize];
  const currentWidth = isCollapsed ? 260 : dims.width;
  const currentHeight = isCollapsed ? 48 : dims.height;

  // Viewport clamping function
  const clampPosition = useCallback((x: number, y: number, width: number, height: number) => {
    if (typeof window === 'undefined') return { x, y };

    const winW = window.innerWidth || 1024;
    const winH = window.innerHeight || 768;
    const isMobile = winW <= 768;

    // Safety margins: on mobile, protect the 60px bottom nav bar (+ 8px safety margin = 68px)
    const minX = isMobile ? 8 : 16;
    const maxX = Math.max(minX, winW - width - (isMobile ? 8 : 16));
    const minY = isMobile ? 8 : 16;
    const maxY = Math.max(minY, winH - height - (isMobile ? 68 : 16));

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  // Initialize or re-clamp position when viewport changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!position) {
      const winW = window.innerWidth || 1024;
      const winH = window.innerHeight || 768;
      const isMobile = winW <= 768;
      const initialX = winW - currentWidth - (isMobile ? 12 : 24);
      const initialY = winH - currentHeight - (isMobile ? 74 : 24);
      setPosition(clampPosition(initialX, initialY, currentWidth, currentHeight));
    } else {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y, currentWidth, currentHeight) : null));
    }
  }, [clampPosition, currentWidth, currentHeight]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y, currentWidth, currentHeight) : null));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, currentWidth, currentHeight]);

  // Dragging event handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!position) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header/handle, ignore button clicks
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const nextX = dragStartRef.current.initialX + dx;
      const nextY = dragStartRef.current.initialY + dy;
      setPosition(clampPosition(nextX, nextY, currentWidth, currentHeight));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - dragStartRef.current.startX;
        const dy = e.touches[0].clientY - dragStartRef.current.startY;
        const nextX = dragStartRef.current.initialX + dx;
        const nextY = dragStartRef.current.initialY + dy;
        setPosition(clampPosition(nextX, nextY, currentWidth, currentHeight));
      }
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, clampPosition, currentWidth, currentHeight]);

  // Determine active visual stream
  const remotePeersArray = Array.from(peersMap.values());
  const peerWithVideo = remotePeersArray.find(
    (p) => p.stream && p.stream.getVideoTracks().length > 0 && p.videoEnabled !== false
  );

  const activeStream =
    screenStream && screenStream.getVideoTracks().length > 0
      ? screenStream
      : peerWithVideo?.stream && peerWithVideo.stream.getVideoTracks().length > 0
      ? peerWithVideo.stream
      : videoEnabled && localStream && localStream.getVideoTracks().length > 0
      ? localStream
      : null;

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

  // Only render when meeting is in active 'dock' state
  if (state !== 'dock' || !activeRoomId) {
    return null;
  }

  const count = authoritativeParticipants.length || participantCount || peersMap.size + 1;
  const roomName = roomData?.room?.name || 'Study Room';
  const displayPeer = peerWithVideo || remotePeersArray[0];

  // Cycle dock sizes: compact -> normal -> expanded -> compact
  const handleCycleSize = () => {
    setDockSize((prev) => {
      if (prev === 'compact') return 'normal';
      if (prev === 'normal') return 'expanded';
      return 'compact';
    });
  };

  const currentX = position ? position.x : 24;
  const currentY = position ? position.y : 24;

  const dockContent = (
    <div
      id="studysync-floating-meeting-overlay"
      data-testid="meeting-floating-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        overflow: 'hidden',
      }}
    >
      <aside
        ref={dockRef}
        data-testid="meeting-floating-dock"
        aria-label="Active Study Room Persistent Floating Window"
        style={{
          position: 'fixed',
          left: `${currentX}px`,
          top: `${currentY}px`,
          width: `${currentWidth}px`,
          pointerEvents: 'auto',
          backgroundColor: '#0F172A',
          borderRadius: isCollapsed ? '24px' : '16px',
          border: '1.5px solid #334155',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          userSelect: isDragging ? 'none' : 'auto',
          transition: isDragging ? 'none' : 'width 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.18s ease',
          animation: 'studysync-slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header / Drag Bar */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            padding: isCollapsed ? '8px 12px' : '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: isCollapsed ? 'none' : '1px solid #1E293B',
            backgroundColor: '#0B1120',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {/* Left: Drag grip, Live indicator & Room name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <GripHorizontal size={14} color="#64748B" style={{ flexShrink: 0 }} />
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
                fontSize: '12px',
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

          {/* Right: Participant badge, Size toggle, Collapse toggle, Return to Room */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                marginRight: '2px',
              }}
              aria-label={`${count} participants`}
            >
              <Users size={12} />
              {count}
            </span>

            {/* Size Toggle (Only when expanded) */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={handleCycleSize}
                aria-label={`Change size: current ${dockSize}`}
                title={`Change size: current ${dockSize} (click to cycle)`}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px 5px',
                  borderRadius: '5px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {dockSize === 'compact' ? 'S' : dockSize === 'normal' ? 'M' : 'L'}
              </button>
            )}

            {/* Collapse/Minimize to pill button */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Restore floating window preview' : 'Minimize to compact bar'}
              title={isCollapsed ? 'Restore floating window preview' : 'Minimize to compact bar'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
            >
              {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Expand to full Study Room */}
            <button
              type="button"
              onClick={restoreMeeting}
              aria-label="Return to full room"
              title="Return to full room"
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
        </div>

        {/* Normal Video Preview Body */}
        {!isCollapsed && (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Click or press Enter to return to full study room"
              style={{
                position: 'relative',
                height: dockSize === 'compact' ? '105px' : dockSize === 'expanded' ? '210px' : '145px',
                backgroundColor: '#020617',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={restoreMeeting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  restoreMeeting();
                }
              }}
            >
              {activeStream ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    backgroundColor: '#020617',
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: '12px' }}>
                  <div
                    style={{
                      width: dockSize === 'compact' ? '36px' : '44px',
                      height: dockSize === 'compact' ? '36px' : '44px',
                      borderRadius: '50%',
                      backgroundColor: '#1E293B',
                      color: '#38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 6px',
                      fontSize: dockSize === 'compact' ? '15px' : '18px',
                      fontWeight: 800,
                      border: '1.5px solid rgba(56, 189, 248, 0.4)',
                    }}
                  >
                    {(displayPeer?.fullName || displayPeer?.username || user?.full_name || 'S')[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#E2E8F0', display: 'block' }}>
                    {displayPeer?.fullName || displayPeer?.username || 'Study Session Active'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>
                    {audioEnabled || displayPeer?.audioEnabled ? 'Audio Active' : 'Meeting in progress'}
                  </span>
                </div>
              )}

              {/* Presentation Badges */}
              {activeScreenSharer && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    backgroundColor: 'rgba(2, 132, 199, 0.92)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <MonitorUp size={10} />
                  <span>Screen: {activeScreenSharer.username}</span>
                </div>
              )}

              {activeWhiteboardSharer && (
                <div
                  style={{
                    position: 'absolute',
                    top: activeScreenSharer ? '28px' : '6px',
                    left: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.92)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <PenTool size={10} />
                  <span>Board: {activeWhiteboardSharer.username}</span>
                </div>
              )}

              {/* Hover / click hint */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  right: '6px',
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.85)',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                Click to expand
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: '#0F172A',
              }}
            >
              {/* Toggle Mic */}
              <button
                type="button"
                onClick={toggleMic}
                aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                style={{
                  width: '32px',
                  height: '32px',
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
                {audioEnabled ? <Mic size={15} color="#38BDF8" /> : <MicOff size={15} color="#FFFFFF" />}
              </button>

              {/* Toggle Camera */}
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
                title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
                style={{
                  width: '32px',
                  height: '32px',
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
                {videoEnabled ? <Video size={15} color="#38BDF8" /> : <VideoOff size={15} color="#FFFFFF" />}
              </button>

              {/* Return to Room Button */}
              <button
                type="button"
                onClick={restoreMeeting}
                aria-label="Return to full room"
                title="Return to full study room"
                style={{
                  padding: '5px 12px',
                  borderRadius: '18px',
                  border: '1px solid #0284C7',
                  backgroundColor: 'rgba(2, 132, 199, 0.2)',
                  color: '#38BDF8',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Maximize2 size={12} />
                <span>Return</span>
              </button>

              {/* Leave Room Button */}
              <button
                type="button"
                onClick={leaveRoom}
                aria-label="Leave study room"
                title="Leave study room"
                style={{
                  width: '32px',
                  height: '32px',
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
                <PhoneOff size={15} />
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );

  const overlayTarget =
    typeof document !== 'undefined'
      ? document.getElementById('studysync-floating-overlay-root') || document.body
      : null;

  return overlayTarget ? createPortal(dockContent, overlayTarget) : dockContent;
};
