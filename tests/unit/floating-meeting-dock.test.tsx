// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FloatingMeetingDock } from '../../client/src/components/FloatingMeetingDock';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Mic: () => <span data-testid="mic-icon">Mic</span>,
  MicOff: () => <span data-testid="mic-off-icon">MicOff</span>,
  Video: () => <span data-testid="video-icon">Video</span>,
  VideoOff: () => <span data-testid="video-off-icon">VideoOff</span>,
  Maximize2: () => <span data-testid="maximize-icon">Max</span>,
  PhoneOff: () => <span data-testid="phone-off-icon">Leave</span>,
  MonitorUp: () => <span data-testid="monitor-icon">Screen</span>,
  PenTool: () => <span data-testid="pen-icon">Board</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  ChevronDown: () => <span data-testid="chevron-down-icon">Down</span>,
  ChevronUp: () => <span data-testid="chevron-up-icon">Up</span>,
  GripHorizontal: () => <span data-testid="grip-icon">Grip</span>,
}));

// Mock Meeting Context
const mockToggleMic = vi.fn();
const mockToggleCamera = vi.fn();
const mockLeaveRoom = vi.fn();
const mockRestoreMeeting = vi.fn();

let mockMeetingState: any = {
  activeRoomId: 'room-101',
  state: 'dock',
  roomData: { room: { id: 'room-101', name: 'CS 101 Algorithms' } },
  peersMap: new Map(),
  localStream: null,
  screenStream: null,
  audioEnabled: true,
  videoEnabled: true,
  activeScreenSharer: null,
  activeWhiteboardSharer: null,
  participantCount: 3,
  authoritativeParticipants: [
    { id: 'u1', username: 'alex', full_name: 'Alex Rivera' },
    { id: 'u2', username: 'jordan', full_name: 'Jordan Lee' },
  ],
  toggleMic: mockToggleMic,
  toggleCamera: mockToggleCamera,
  leaveRoom: mockLeaveRoom,
  restoreMeeting: mockRestoreMeeting,
};

vi.mock('../../client/src/meeting/MeetingProvider', () => ({
  useMeeting: () => mockMeetingState,
}));

vi.mock('../../client/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', full_name: 'Alex Rivera', username: 'alex' },
  }),
}));

describe('Persistent Application-Level Floating Meeting Dock Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure document overlay root exists
    let overlayRoot = document.getElementById('studysync-floating-overlay-root');
    if (!overlayRoot) {
      overlayRoot = document.createElement('div');
      overlayRoot.id = 'studysync-floating-overlay-root';
      document.body.appendChild(overlayRoot);
    }
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Top-Level Stacking Context & Portal Mounting', () => {
    it('Renders into the dedicated #studysync-floating-overlay-root outside #root', () => {
      render(<FloatingMeetingDock />);
      const overlayRoot = document.getElementById('studysync-floating-overlay-root');
      expect(overlayRoot).toBeTruthy();

      const overlay = overlayRoot?.querySelector('[data-testid="meeting-floating-overlay"]');
      expect(overlay).toBeTruthy();
    });

    it('Uses z-index 10000 and pointer-events: none on overlay to prevent blocking underlying pages', () => {
      render(<FloatingMeetingDock />);
      const overlay = screen.getByTestId('meeting-floating-overlay');
      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.zIndex).toBe('10000');
      expect(overlay.style.pointerEvents).toBe('none');
    });

    it('Enables pointer-events: auto on the dock container for full interactivity', () => {
      render(<FloatingMeetingDock />);
      const dock = screen.getByTestId('meeting-floating-dock');
      expect(dock.style.pointerEvents).toBe('auto');
      expect(dock.style.position).toBe('fixed');
    });

    it('Does not render when meeting is not in dock state or has no active room', () => {
      mockMeetingState = { ...mockMeetingState, state: 'full' };
      const { container } = render(<FloatingMeetingDock />);
      expect(container.querySelector('[data-testid="meeting-floating-dock"]')).toBeNull();

      // Reset back to dock
      mockMeetingState = { ...mockMeetingState, state: 'dock' };
    });
  });

  describe('2. Floating Window Dragging & Viewport Boundary Enforcement', () => {
    it('Initializes position within the viewport and supports mouse dragging', () => {
      render(<FloatingMeetingDock />);
      const dock = screen.getByTestId('meeting-floating-dock');
      expect(dock.style.left).toBeDefined();
      expect(dock.style.top).toBeDefined();

      const header = dock.querySelector('div');
      expect(header).toBeTruthy();

      // Initiate drag
      fireEvent.mouseDown(header!, { clientX: 500, clientY: 500 });
      fireEvent.mouseMove(window, { clientX: 450, clientY: 420 });
      fireEvent.mouseUp(window);

      // Dock remains positioned
      expect(dock.style.left).toBeTruthy();
      expect(dock.style.top).toBeTruthy();
    });

    it('Clamps position to never go off-screen on the right or bottom', () => {
      render(<FloatingMeetingDock />);
      const dock = screen.getByTestId('meeting-floating-dock');
      const header = dock.querySelector('div');

      // Attempt to drag way past screen bounds
      fireEvent.mouseDown(header!, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 99999, clientY: 99999 });
      fireEvent.mouseUp(window);

      const left = parseInt(dock.style.left, 10);
      const top = parseInt(dock.style.top, 10);

      // Should be clamped within viewport
      expect(left).toBeLessThanOrEqual(window.innerWidth);
      expect(top).toBeLessThanOrEqual(window.innerHeight);
    });
  });

  describe('3. Dock Modes, Resizing & Collapse/Restore', () => {
    it('Renders room name and participant count in the header', () => {
      render(<FloatingMeetingDock />);
      expect(screen.getByText('CS 101 Algorithms')).toBeTruthy();
      expect(screen.getByLabelText('2 participants')).toBeTruthy();
    });

    it('Cycles dock size between compact (S), normal (M), and expanded (L)', () => {
      render(<FloatingMeetingDock />);
      const sizeBtn = screen.getByLabelText(/Change size/i);
      expect(sizeBtn.textContent).toBe('M'); // default normal

      fireEvent.click(sizeBtn);
      expect(sizeBtn.textContent).toBe('L'); // expanded

      fireEvent.click(sizeBtn);
      expect(sizeBtn.textContent).toBe('S'); // compact

      fireEvent.click(sizeBtn);
      expect(sizeBtn.textContent).toBe('M'); // back to normal
    });

    it('Collapses into a compact pill bar and expands back without leaving the meeting', () => {
      render(<FloatingMeetingDock />);
      const collapseBtn = screen.getByLabelText(/Minimize to compact bar/i);
      fireEvent.click(collapseBtn);

      // Dock should now be collapsed (no video preview, height is 48px)
      const dock = screen.getByTestId('meeting-floating-dock');
      expect(dock.style.width).toBe('260px');

      // Expand back
      const expandBtn = screen.getByLabelText(/Restore floating window preview/i);
      fireEvent.click(expandBtn);
      expect(dock.style.width).toBe('340px'); // normal size restored
      expect(mockLeaveRoom).not.toHaveBeenCalled();
    });

    it('Triggers restoreMeeting() when clicking Return button or preview area', () => {
      render(<FloatingMeetingDock />);
      const returnBtns = screen.getAllByLabelText('Return to full room');
      expect(returnBtns.length).toBeGreaterThan(0);
      fireEvent.click(returnBtns[0]);

      expect(mockRestoreMeeting).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Audio & Video Controls & Explicit Leave', () => {
    it('Toggles microphone state via toggleMic', () => {
      render(<FloatingMeetingDock />);
      const micBtn = screen.getByLabelText('Mute microphone');
      fireEvent.click(micBtn);

      expect(mockToggleMic).toHaveBeenCalledTimes(1);
    });

    it('Toggles camera state via toggleCamera', () => {
      render(<FloatingMeetingDock />);
      const camBtn = screen.getByLabelText('Turn camera off');
      fireEvent.click(camBtn);

      expect(mockToggleCamera).toHaveBeenCalledTimes(1);
    });

    it('Terminates meeting only upon explicit Leave button click', () => {
      render(<FloatingMeetingDock />);
      const leaveBtn = screen.getByLabelText('Leave study room');
      fireEvent.click(leaveBtn);

      expect(mockLeaveRoom).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Presentation Badges', () => {
    it('Renders screen share presenter badge when someone is sharing screen', () => {
      mockMeetingState = {
        ...mockMeetingState,
        activeScreenSharer: { od: 'u2', username: 'jordan', isLocal: false },
      };
      render(<FloatingMeetingDock />);
      expect(screen.getByText('Screen: jordan')).toBeTruthy();
    });

    it('Renders whiteboard presenter badge when someone is sharing whiteboard', () => {
      mockMeetingState = {
        ...mockMeetingState,
        activeWhiteboardSharer: { od: 'u1', username: 'alex', isLocal: true },
      };
      render(<FloatingMeetingDock />);
      expect(screen.getByText('Board: alex')).toBeTruthy();
    });
  });
});
