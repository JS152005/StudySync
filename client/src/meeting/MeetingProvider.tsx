import React, { createContext, useContext, useRef, useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MeetingSession,
  Participant,
  PeerInfo,
  SharerInfo,
  WhiteboardStrokeAction,
} from './MeetingSession';
import { MeetingState } from './meetingStateMachine';
import { isDocumentPipSupported } from './pipCapability';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { MeetingPiPView } from '../components/MeetingPiPView';
import { PhoneOff } from 'lucide-react';

export type {
  Participant,
  PeerInfo,
  SharerInfo,
  WhiteboardStrokeAction,
  MeetingState,
};

export interface MeetingContextType {
  activeRoomId: string | null;
  state: MeetingState;
  roomData: any | null;
  minimized: boolean;
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
  isHost: boolean;
  session: MeetingSession;

  joinRoom: (roomId: string, initialData?: any) => Promise<void>;
  leaveRoom: () => Promise<void>;
  endRoom: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  toggleHand: () => Promise<void>;
  setWhiteboardSharing: (active: boolean) => void;
  addWhiteboardStroke: (stroke: any) => void;
  clearWhiteboard: () => void;
  setActiveView: (view: 'video' | 'whiteboard') => void;
  setShowParticipants: (show: boolean | ((prev: boolean) => boolean)) => void;
  setMinimized: (min: boolean) => void;
  restoreMeeting: () => void;
  dockMeeting: () => void;
  refreshRoomData: () => Promise<void>;
  requestPictureInPicture: (videoEl: HTMLVideoElement | null) => Promise<void>;
  isDocumentPipSupported: boolean;
  isDocumentPipActive: boolean;
  openDocumentPictureInPicture: () => Promise<void>;
  closeDocumentPictureInPicture: () => void;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

function copyStylesheetsToPip(pipWindow: Window) {
  try {
    const allSheets = Array.from(document.styleSheets);
    allSheets.forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
          const style = pipWindow.document.createElement('style');
          style.textContent = rules;
          pipWindow.document.head.appendChild(style);
        }
      } catch (e) {
        // Cross-origin stylesheet rules are protected; clone <link> instead
        if (sheet.href) {
          const link = pipWindow.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pipWindow.document.head.appendChild(link);
        }
      }
    });

    // Also copy any direct <style> nodes in document head
    document.querySelectorAll('style').forEach((styleEl) => {
      const cloned = styleEl.cloneNode(true) as HTMLStyleElement;
      pipWindow.document.head.appendChild(cloned);
    });
  } catch (err) {
    console.warn('[PiP] Error synchronizing stylesheets to PiP window:', err);
  }
}

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const sessionRef = useRef<MeetingSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new MeetingSession({ currentUserId: user?.id });
  }
  const session = sessionRef.current;

  // Single-meeting policy: Prompt if trying to join a second room while one is active
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; initialData?: any } | null>(null);

  // Document Picture-in-Picture window and portal state
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipSupported = isDocumentPipSupported();

  // Sync user identity to session
  useEffect(() => {
    session.setCurrentUserId(user?.id || null);
  }, [session, user?.id]);

  // Clean up meeting session on user logout
  useEffect(() => {
    if (!user && session.getSnapshot().activeRoomId) {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
      }
      pipWindowRef.current = null;
      setPipContainer(null);
      session.leave().catch(() => {});
    }
  }, [user, session]);

  // Subscribe to plain TypeScript meeting session using React useSyncExternalStore
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);

  // Surface device errors as toast notices
  useEffect(() => {
    if (snapshot.deviceError) {
      toast.error(snapshot.deviceError);
    }
  }, [snapshot.deviceError, toast]);

  // Automatically dock meeting if navigating away from the active room (only when in full state)
  useEffect(() => {
    if (!snapshot.activeRoomId) return;
    const isCurrentRoomRoute = location.pathname.startsWith(`/rooms/${snapshot.activeRoomId}`);

    if (!isCurrentRoomRoute && snapshot.state === 'full') {
      session.dock();
    }
  }, [location.pathname, snapshot.activeRoomId, snapshot.state, session]);

  const closeDocumentPictureInPicture = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try {
        pipWindowRef.current.close();
      } catch {}
    }
    pipWindowRef.current = null;
    setPipContainer(null);
  }, []);

  const openDocumentPictureInPicture = useCallback(async (): Promise<void> => {
    // Replaced external browser Document Picture-in-Picture with persistent in-app floating dock
    session.dock();
    toast.info('Active meeting minimized to floating window');
  }, [session, toast]);

  const joinRoom = useCallback(async (roomId: string, initialData?: any) => {
    const current = session.getSnapshot();
    if (current.activeRoomId && current.activeRoomId !== roomId && current.state !== 'idle') {
      // User is already in another meeting — prompt to leave first
      setPendingJoin({ roomId, initialData });
      return;
    }
    await session.join(roomId, initialData);
  }, [session]);

  const handleConfirmSwitchRoom = useCallback(async () => {
    if (!pendingJoin) return;
    const { roomId, initialData } = pendingJoin;
    setPendingJoin(null);

    closeDocumentPictureInPicture();
    await session.leave();
    await session.join(roomId, initialData);
    navigate(`/rooms/${roomId}`);
  }, [pendingJoin, session, navigate, closeDocumentPictureInPicture]);

  const handleCancelSwitchRoom = useCallback(() => {
    setPendingJoin(null);
  }, []);

  const leaveRoom = useCallback(async () => {
    closeDocumentPictureInPicture();
    await session.leave();
    navigate('/rooms');
    toast.info('Left study room');
  }, [session, navigate, toast, closeDocumentPictureInPicture]);

  const endRoom = useCallback(async () => {
    closeDocumentPictureInPicture();
    await session.endRoom();
    navigate('/rooms');
    toast.info('Study session concluded');
  }, [session, navigate, toast, closeDocumentPictureInPicture]);

  const restoreMeeting = useCallback(() => {
    if (snapshot.activeRoomId) {
      closeDocumentPictureInPicture();
      session.restore();
      try {
        window.focus();
      } catch {}
      navigate(`/rooms/${snapshot.activeRoomId}`);
    }
  }, [snapshot.activeRoomId, session, navigate, closeDocumentPictureInPicture]);

  const dockMeeting = useCallback(() => {
    session.dock();
  }, [session]);

  const setMinimized = useCallback((min: boolean) => {
    if (min) {
      session.dock();
    } else {
      session.restore();
    }
  }, [session]);

  const toggleCamera = useCallback(async () => {
    await session.toggleCamera();
  }, [session]);

  const toggleMic = useCallback(async () => {
    await session.toggleMic();
  }, [session]);

  const startScreenShare = useCallback(async () => {
    await session.startScreenShare();
  }, [session]);

  const stopScreenShare = useCallback(() => {
    session.stopScreenShare();
  }, [session]);

  const toggleHand = useCallback(async () => {
    await session.toggleHand();
  }, [session]);

  const setWhiteboardSharing = useCallback((active: boolean) => {
    session.setWhiteboardSharing(active);
  }, [session]);

  const addWhiteboardStroke = useCallback((stroke: any) => {
    session.addWhiteboardStroke(stroke);
  }, [session]);

  const clearWhiteboard = useCallback(() => {
    session.clearWhiteboard();
  }, [session]);

  const setActiveView = useCallback((view: 'video' | 'whiteboard') => {
    session.setActiveView(view);
  }, [session]);

  const setShowParticipants = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    session.setShowParticipants(show);
  }, [session]);

  const refreshRoomData = useCallback(async () => {
    await session.refreshRoomData();
  }, [session]);

  const requestPictureInPicture = useCallback(async (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoEl.requestPictureInPicture) {
        await videoEl.requestPictureInPicture();
      }
    } catch {}
  }, []);

  const isHost = Boolean(snapshot.roomData?.room?.host_id && user?.id && snapshot.roomData.room.host_id === user.id);

  return (
    <MeetingContext.Provider
      value={{
        activeRoomId: snapshot.activeRoomId,
        state: snapshot.state,
        roomData: snapshot.roomData,
        minimized: snapshot.state === 'dock',
        localStream: snapshot.localStream,
        screenStream: snapshot.screenStream,
        audioEnabled: snapshot.audioEnabled,
        videoEnabled: snapshot.videoEnabled,
        isSharingScreen: snapshot.isSharingScreen,
        isHandRaised: snapshot.isHandRaised,
        activeScreenSharer: snapshot.activeScreenSharer,
        activeWhiteboardSharer: snapshot.activeWhiteboardSharer,
        peersMap: snapshot.peersMap,
        authoritativeParticipants: snapshot.authoritativeParticipants,
        participantCount: snapshot.participantCount,
        whiteboardActions: snapshot.whiteboardActions,
        whiteboardVersion: snapshot.whiteboardVersion,
        deviceError: snapshot.deviceError,
        noiseSuppressionActive: snapshot.noiseSuppressionActive,
        activeView: snapshot.activeView,
        showParticipants: snapshot.showParticipants,
        isHost,
        session,

        joinRoom,
        leaveRoom,
        endRoom,
        toggleCamera,
        toggleMic,
        startScreenShare,
        stopScreenShare,
        toggleHand,
        setWhiteboardSharing,
        addWhiteboardStroke,
        clearWhiteboard,
        setActiveView,
        setShowParticipants,
        setMinimized,
        restoreMeeting,
        dockMeeting,
        refreshRoomData,
        requestPictureInPicture,
        isDocumentPipSupported: pipSupported,
        isDocumentPipActive: snapshot.state === 'pip',
        openDocumentPictureInPicture,
        closeDocumentPictureInPicture,
      }}
    >
      {children}

      {/* Render Document Picture-in-Picture meeting UI into the PiP window's portal container */}
      {pipContainer && createPortal(<MeetingPiPView />, pipContainer)}

      {/* Switch Meeting Confirmation Modal */}
      {pendingJoin && (
        <Modal
          isOpen={true}
          onClose={handleCancelSwitchRoom}
          title="Switch Active Meeting?"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, color: '#334155', fontSize: '14px', lineHeight: 1.6 }}>
              You are currently participating in an active study room. StudySync allows only one active meeting at a time.
            </p>
            <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
              Would you like to leave your current session and join the new room?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <Button variant="ghost" onClick={handleCancelSwitchRoom}>
                Stay in Current Room
              </Button>
              <Button
                variant="vermilion"
                onClick={handleConfirmSwitchRoom}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <PhoneOff size={15} />
                Leave & Join New Room
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
