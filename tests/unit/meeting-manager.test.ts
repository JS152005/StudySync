import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MeetingState,
  MeetingEvent,
  transitionMeetingState,
} from '../../client/src/meeting/meetingStateMachine';
import {
  MeetingSession,
  MeetingSnapshot,
} from '../../client/src/meeting/MeetingSession';
import { isDocumentPipSupported } from '../../client/src/meeting/pipCapability';

describe('Document Picture-in-Picture Capability Detection', () => {
  it('returns true when documentPictureInPicture is available on window (Chromium 116+)', () => {
    const mockWindow = { documentPictureInPicture: {} };
    expect(isDocumentPipSupported(mockWindow)).toBe(true);
  });

  it('returns false when documentPictureInPicture is absent (Firefox / Safari)', () => {
    const mockWindow = {};
    expect(isDocumentPipSupported(mockWindow)).toBe(false);
  });

  it('returns false in non-browser or SSR environments without window', () => {
    expect(isDocumentPipSupported(undefined)).toBe(false);
    expect(isDocumentPipSupported(null)).toBe(false);
  });
});

describe('Meeting State Machine Transitions (including PiP)', () => {
  it('handles all valid transitions from idle', () => {
    expect(transitionMeetingState('idle', { type: 'JOIN_START' })).toBe('joining');
  });

  it('rejects invalid transitions from idle', () => {
    expect(transitionMeetingState('idle', { type: 'JOIN_SUCCESS' })).toBe('idle');
    expect(transitionMeetingState('idle', { type: 'DOCK' })).toBe('idle');
    expect(transitionMeetingState('idle', { type: 'RESTORE' })).toBe('idle');
    expect(transitionMeetingState('idle', { type: 'DISCONNECTED' })).toBe('idle');
    expect(transitionMeetingState('idle', { type: 'ROOM_ENDED' })).toBe('idle');
    expect(transitionMeetingState('idle', { type: 'PIP' })).toBe('idle');
  });

  it('handles all valid transitions from joining', () => {
    expect(transitionMeetingState('joining', { type: 'JOIN_SUCCESS' })).toBe('full');
    expect(transitionMeetingState('joining', { type: 'DOCK' })).toBe('dock');
    expect(transitionMeetingState('joining', { type: 'NAVIGATE_AWAY' })).toBe('dock');
    expect(transitionMeetingState('joining', { type: 'DISCONNECTED' })).toBe('disconnected');
    expect(transitionMeetingState('joining', { type: 'ROOM_ENDED' })).toBe('ended');
    expect(transitionMeetingState('joining', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from joining', () => {
    expect(transitionMeetingState('joining', { type: 'JOIN_START' })).toBe('joining');
    expect(transitionMeetingState('joining', { type: 'RESTORE' })).toBe('joining');
    expect(transitionMeetingState('joining', { type: 'PIP' })).toBe('joining');
  });

  it('handles all valid transitions from full (including opening PiP)', () => {
    expect(transitionMeetingState('full', { type: 'PIP' })).toBe('pip');
    expect(transitionMeetingState('full', { type: 'DOCK' })).toBe('dock');
    expect(transitionMeetingState('full', { type: 'NAVIGATE_AWAY' })).toBe('dock');
    expect(transitionMeetingState('full', { type: 'DISCONNECTED' })).toBe('disconnected');
    expect(transitionMeetingState('full', { type: 'ROOM_ENDED' })).toBe('ended');
    expect(transitionMeetingState('full', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from full', () => {
    expect(transitionMeetingState('full', { type: 'JOIN_START' })).toBe('full');
    expect(transitionMeetingState('full', { type: 'JOIN_SUCCESS' })).toBe('full');
    expect(transitionMeetingState('full', { type: 'RESTORE' })).toBe('full');
  });

  it('handles all valid transitions from dock (including opening PiP)', () => {
    expect(transitionMeetingState('dock', { type: 'PIP' })).toBe('pip');
    expect(transitionMeetingState('dock', { type: 'RESTORE' })).toBe('restoring');
    expect(transitionMeetingState('dock', { type: 'RESTORE_SUCCESS' })).toBe('full');
    expect(transitionMeetingState('dock', { type: 'DISCONNECTED' })).toBe('disconnected');
    expect(transitionMeetingState('dock', { type: 'ROOM_ENDED' })).toBe('ended');
    expect(transitionMeetingState('dock', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from dock', () => {
    expect(transitionMeetingState('dock', { type: 'JOIN_START' })).toBe('dock');
    expect(transitionMeetingState('dock', { type: 'JOIN_SUCCESS' })).toBe('dock');
  });

  it('handles all valid transitions from pip', () => {
    // Restore to full meeting
    expect(transitionMeetingState('pip', { type: 'RESTORE_SUCCESS' })).toBe('full');
    expect(transitionMeetingState('pip', { type: 'RESTORE' })).toBe('restoring');

    // PiP closed by user or system -> MUST NEVER leave room, always falls back to dock
    expect(transitionMeetingState('pip', { type: 'PIP_CLOSED' })).toBe('dock');
    expect(transitionMeetingState('pip', { type: 'DOCK' })).toBe('dock');
    expect(transitionMeetingState('pip', { type: 'NAVIGATE_AWAY' })).toBe('dock');

    // Connection loss or room ended
    expect(transitionMeetingState('pip', { type: 'DISCONNECTED' })).toBe('disconnected');
    expect(transitionMeetingState('pip', { type: 'ROOM_ENDED' })).toBe('ended');

    // Explicit leave
    expect(transitionMeetingState('pip', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from pip', () => {
    expect(transitionMeetingState('pip', { type: 'JOIN_START' })).toBe('pip');
    expect(transitionMeetingState('pip', { type: 'JOIN_SUCCESS' })).toBe('pip');
    expect(transitionMeetingState('pip', { type: 'PIP' })).toBe('pip');
  });

  it('handles all valid transitions from restoring', () => {
    expect(transitionMeetingState('restoring', { type: 'RESTORE_SUCCESS' })).toBe('full');
    expect(transitionMeetingState('restoring', { type: 'PIP' })).toBe('pip');
    expect(transitionMeetingState('restoring', { type: 'DOCK' })).toBe('dock');
    expect(transitionMeetingState('restoring', { type: 'NAVIGATE_AWAY' })).toBe('dock');
    expect(transitionMeetingState('restoring', { type: 'DISCONNECTED' })).toBe('disconnected');
    expect(transitionMeetingState('restoring', { type: 'ROOM_ENDED' })).toBe('ended');
    expect(transitionMeetingState('restoring', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from restoring', () => {
    expect(transitionMeetingState('restoring', { type: 'JOIN_START' })).toBe('restoring');
    expect(transitionMeetingState('restoring', { type: 'RESTORE' })).toBe('restoring');
  });

  it('handles all valid transitions from disconnected (including target pip)', () => {
    expect(transitionMeetingState('disconnected', { type: 'RECONNECTED' })).toBe('full');
    expect(transitionMeetingState('disconnected', { type: 'RECONNECTED', target: 'dock' })).toBe('dock');
    expect(transitionMeetingState('disconnected', { type: 'RECONNECTED', target: 'pip' })).toBe('pip');
    expect(transitionMeetingState('disconnected', { type: 'JOIN_START' })).toBe('joining');
    expect(transitionMeetingState('disconnected', { type: 'ROOM_ENDED' })).toBe('ended');
    expect(transitionMeetingState('disconnected', { type: 'LEAVE' })).toBe('ended');
  });

  it('rejects invalid transitions from disconnected', () => {
    expect(transitionMeetingState('disconnected', { type: 'DOCK' })).toBe('disconnected');
    expect(transitionMeetingState('disconnected', { type: 'RESTORE' })).toBe('disconnected');
    expect(transitionMeetingState('disconnected', { type: 'PIP' })).toBe('disconnected');
  });

  it('handles all valid transitions from ended', () => {
    expect(transitionMeetingState('ended', { type: 'RESET' })).toBe('idle');
    expect(transitionMeetingState('ended', { type: 'LEAVE' })).toBe('idle');
    expect(transitionMeetingState('ended', { type: 'JOIN_START' })).toBe('joining');
  });

  it('rejects invalid transitions from ended', () => {
    expect(transitionMeetingState('ended', { type: 'DOCK' })).toBe('ended');
    expect(transitionMeetingState('ended', { type: 'RESTORE' })).toBe('ended');
    expect(transitionMeetingState('ended', { type: 'DISCONNECTED' })).toBe('ended');
    expect(transitionMeetingState('ended', { type: 'PIP' })).toBe('ended');
  });
});

describe('MeetingSession Application Manager with External PiP & Collaboration', () => {
  let mockSocket: any;
  let socketCallbacks: Map<string, Function>;
  let mockPeerConnections: any[];
  let MockRTCPeerConnection: any;
  let mockMediaDevices: any;
  let mockApiRequest: any;

  beforeEach(() => {
    socketCallbacks = new Map();
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        socketCallbacks.set(event, cb);
      }),
      off: vi.fn((event: string) => {
        socketCallbacks.delete(event);
      }),
    };

    mockPeerConnections = [];

    MockRTCPeerConnection = class {
      public signalingState = 'stable';
      public connectionState = 'connected';
      public ontrack: any = null;
      public onicecandidate: any = null;
      public onconnectionstatechange: any = null;
      public close = vi.fn();
      public createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'fake-offer' });
      public createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'fake-answer' });
      public setLocalDescription = vi.fn().mockResolvedValue(undefined);
      public setRemoteDescription = vi.fn().mockResolvedValue(undefined);
      public addIceCandidate = vi.fn().mockResolvedValue(undefined);
      public addTransceiver = vi.fn().mockReturnValue({
        sender: { replaceTrack: vi.fn().mockResolvedValue(undefined) },
        receiver: { track: { kind: 'video' } },
      });
      public getTransceivers = vi.fn().mockReturnValue([
        {
          sender: { replaceTrack: vi.fn().mockResolvedValue(undefined) },
          receiver: { track: { kind: 'audio' } },
        },
        {
          sender: { replaceTrack: vi.fn().mockResolvedValue(undefined) },
          receiver: { track: { kind: 'video' } },
        },
      ]);
      public getSenders = vi.fn().mockReturnValue([]);
      public addTrack = vi.fn();

      constructor() {
        mockPeerConnections.push(this);
      }
    };

    const makeFakeTrack = (kind: string) => ({
      id: `${kind}-${Date.now()}-${Math.random()}`,
      kind,
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({ noiseSuppression: true, echoCancellation: true }),
    });

    mockMediaDevices = {
      getUserMedia: vi.fn().mockImplementation(async ({ video, audio }: any) => {
        const tracks: any[] = [];
        if (video) tracks.push(makeFakeTrack('video'));
        if (audio) tracks.push(makeFakeTrack('audio'));
        return {
          getTracks: () => tracks,
          getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
          getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
          addTrack: (t: any) => tracks.push(t),
          removeTrack: (t: any) => {
            const idx = tracks.indexOf(t);
            if (idx >= 0) tracks.splice(idx, 1);
          },
        };
      }),
      getDisplayMedia: vi.fn().mockImplementation(async () => {
        const tracks = [makeFakeTrack('video')];
        return {
          getTracks: () => tracks,
          getVideoTracks: () => tracks,
          getAudioTracks: () => [],
        };
      }),
      getSupportedConstraints: vi.fn().mockReturnValue({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }),
    };

    mockApiRequest = vi.fn().mockResolvedValue({ room: { id: 'test-room-1', name: 'Calculus Session' } });
  });

  it('emits join_study_room exactly once on join and transitions idle -> joining -> full', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    expect(session.getSnapshot().state).toBe('idle');

    await session.join('test-room-1');

    expect(session.getSnapshot().state).toBe('full');
    expect(session.getSnapshot().activeRoomId).toBe('test-room-1');
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith('join_study_room', { roomId: 'test-room-1' });

    expect(mockSocket.on).toHaveBeenCalled();
  });

  it('ignores duplicate join calls when already joining or in the room', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);

    await session.join('test-room-1');
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
  });

  it('supports transitioning to pip and closing pip back to dock without destroying session', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    expect(session.getSnapshot().state).toBe('full');

    // Enter PiP mode
    session.openPip();
    expect(session.getSnapshot().state).toBe('pip');
    expect(session.getSnapshot().activeRoomId).toBe('test-room-1');

    // PiP window closed by user -> MUST fall back to dock, NOT leave
    session.closePip();
    expect(session.getSnapshot().state).toBe('dock');
    expect(session.getSnapshot().activeRoomId).toBe('test-room-1');

    // No leave event was emitted!
    expect(mockSocket.emit).not.toHaveBeenCalledWith('leave_study_room', expect.anything());
  });

  it('continues whiteboard synchronization uninterrupted while in pip state', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    session.openPip();
    expect(session.getSnapshot().state).toBe('pip');

    // Simulate incoming whiteboard stroke event from peer
    const strokeCb = socketCallbacks.get('whiteboard_stroke');
    expect(strokeCb).toBeDefined();

    strokeCb!({
      id: 'stroke-1',
      sequenceNumber: 1,
      userId: 'peer-user-1',
      stroke: { type: 'draw', color: '#0F172A', fromX: 0.1, fromY: 0.2, toX: 0.3, toY: 0.4 },
    });

    expect(session.getSnapshot().whiteboardActions).toHaveLength(1);
    expect(session.getSnapshot().whiteboardVersion).toBe(1);

    // Simulate whiteboard clear event
    const clearCb = socketCallbacks.get('whiteboard_clear');
    expect(clearCb).toBeDefined();

    clearCb!({ sequenceNumber: 2 });
    expect(session.getSnapshot().whiteboardActions).toHaveLength(0);
    expect(session.getSnapshot().whiteboardVersion).toBe(2);
  });

  it('continues screen sharing updates uninterrupted while in pip state', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    session.openPip();
    expect(session.getSnapshot().state).toBe('pip');

    const screenStartCb = socketCallbacks.get('screen_share_started');
    expect(screenStartCb).toBeDefined();

    screenStartCb!({
      userId: 'peer-user-2',
      username: 'alice',
      fullName: 'Alice Smith',
      socketId: 'peer-socket-2',
    });

    expect(session.getSnapshot().activeScreenSharer).toEqual({
      userId: 'peer-user-2',
      username: 'alice',
      fullName: 'Alice Smith',
      socketId: 'peer-socket-2',
    });

    const screenStopCb = socketCallbacks.get('screen_share_stopped');
    expect(screenStopCb).toBeDefined();

    screenStopCb!();
    expect(session.getSnapshot().activeScreenSharer).toBeNull();
  });

  it('leave from pip cleans up all tracks, closes peer connections, removes socket listeners, and transitions ended -> idle', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    await session.toggleCamera();
    session.openPip();
    expect(session.getSnapshot().state).toBe('pip');

    const localStream = session.getSnapshot().localStream;
    expect(localStream).toBeTruthy();
    const tracks = localStream!.getTracks();

    await session.leave();

    // Verify all tracks stopped
    tracks.forEach((t) => {
      expect(t.stop).toHaveBeenCalled();
    });

    // Verify all peer connections closed
    mockPeerConnections.forEach((pc) => {
      expect(pc.close).toHaveBeenCalled();
    });

    // Verify socket leave event emitted and REST leave called
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_study_room', { roomId: 'test-room-1' });
    expect(mockApiRequest).toHaveBeenCalledWith('/rooms/test-room-1/leave', { method: 'POST' });

    // Verify final state is idle and snapshot cleared
    expect(session.getSnapshot().state).toBe('idle');
    expect(session.getSnapshot().activeRoomId).toBeNull();
    expect(session.getSnapshot().localStream).toBeNull();
    expect(session.getSnapshot().videoEnabled).toBe(false);
  });

  it('manages camera toggling: ON acquires track, OFF stops track and replaces sender track with null', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');

    await session.toggleCamera();
    expect(session.getSnapshot().videoEnabled).toBe(true);
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.anything() })
    );

    const videoTrack = session.getSnapshot().localStream?.getVideoTracks()[0];
    expect(videoTrack).toBeTruthy();

    await session.toggleCamera();
    expect(session.getSnapshot().videoEnabled).toBe(false);
    expect(videoTrack!.stop).toHaveBeenCalled();
  });

  it('supports docking and restoring without re-joining or re-acquiring media', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    await session.join('test-room-1');
    expect(session.getSnapshot().state).toBe('full');
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);

    session.dock();
    expect(session.getSnapshot().state).toBe('dock');

    session.restore();
    expect(session.getSnapshot().state).toBe('full');

    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
  });

  it('notifies useSyncExternalStore subscribers on state mutation', async () => {
    const session = new MeetingSession({
      socket: mockSocket,
      PeerConnectionClass: MockRTCPeerConnection,
      mediaDevices: mockMediaDevices,
      apiRequestFn: mockApiRequest,
    });

    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    await session.join('test-room-1');
    expect(listener).toHaveBeenCalled();

    const callCount = listener.mock.calls.length;
    session.dock();
    expect(listener.mock.calls.length).toBeGreaterThan(callCount);

    unsubscribe();
    const afterCount = listener.mock.calls.length;
    session.restore();
    expect(listener.mock.calls.length).toBe(afterCount);
  });
});
