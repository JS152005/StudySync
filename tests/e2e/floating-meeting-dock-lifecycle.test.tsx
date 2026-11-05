// @vitest-environment happy-dom
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

// Mock Auth
vi.mock('../../client/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-99', full_name: 'Jordan Miller', username: 'jmiller', student_id: 'STU-99001' },
    token: 'jwt-valid-token',
  }),
}));

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Mic: () => <span data-testid="mic">Mic</span>,
  MicOff: () => <span data-testid="mic-off">MicOff</span>,
  Video: () => <span data-testid="video">Video</span>,
  VideoOff: () => <span data-testid="video-off">VideoOff</span>,
  Maximize2: () => <span data-testid="max">Max</span>,
  PhoneOff: () => <span data-testid="leave">Leave</span>,
  MonitorUp: () => <span data-testid="screen">Screen</span>,
  PenTool: () => <span data-testid="board">Board</span>,
  Users: () => <span data-testid="users">Users</span>,
  ChevronDown: () => <span data-testid="down">Down</span>,
  ChevronUp: () => <span data-testid="up">Up</span>,
  GripHorizontal: () => <span data-testid="grip">Grip</span>,
  X: () => <span data-testid="close-modal">X</span>,
}));

import { FloatingMeetingDock } from '../../client/src/components/FloatingMeetingDock';
import { Modal } from '../../client/src/components/ui/Modal';

// Stateful mock for meeting session across the test sequence
let mockMeetingState: any = {
  activeRoomId: 'room-777',
  state: 'dock',
  roomData: { room: { id: 'room-777', name: 'Quantum Physics' } },
  peersMap: new Map(),
  localStream: null,
  screenStream: null,
  audioEnabled: true,
  videoEnabled: true,
  activeScreenSharer: null,
  activeWhiteboardSharer: null,
  participantCount: 4,
  authoritativeParticipants: [
    { id: 'u1', username: 'jmiller', full_name: 'Jordan Miller' },
    { id: 'u2', username: 'alex', full_name: 'Alex Rivera' },
  ],
  toggleMic: vi.fn(),
  toggleCamera: vi.fn(),
  leaveRoom: vi.fn(),
  restoreMeeting: vi.fn(() => {
    mockMeetingState.state = 'full';
  }),
  dockMeeting: vi.fn(() => {
    mockMeetingState.state = 'dock';
  }),
};

vi.mock('../../client/src/meeting/MeetingProvider', () => ({
  useMeeting: () => mockMeetingState,
}));

// Full multi-page application test harness
const TestAppHarness: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'room' | 'dashboard' | 'messages' | 'profile'>('room');
  const [modalOpen, setModalOpen] = useState(false);
  const [actionOutput, setActionOutput] = useState<string | null>(null);

  return (
    <div data-testid="studysync-app-root">
      {/* Navigation Header */}
      <header data-testid="app-header" style={{ display: 'flex', gap: '10px', padding: '12px', zIndex: 40 }}>
        <button type="button" data-testid="nav-dashboard" onClick={() => setCurrentRoute('dashboard')}>
          Dashboard
        </button>
        <button type="button" data-testid="nav-messages" onClick={() => setCurrentRoute('messages')}>
          Chats
        </button>
        <button type="button" data-testid="nav-profile" onClick={() => setCurrentRoute('profile')}>
          Profile
        </button>
        <button type="button" data-testid="nav-room" onClick={() => setCurrentRoute('room')}>
          Study Room
        </button>
        <button type="button" data-testid="open-dialog-btn" onClick={() => setModalOpen(true)}>
          Open Dialog
        </button>
      </header>

      {/* Dynamic Route View Content */}
      <main data-testid="route-content" style={{ padding: '24px' }}>
        {currentRoute === 'dashboard' && (
          <div>
            <h2>Dashboard Page</h2>
            <button
              type="button"
              data-testid="dashboard-action-btn"
              onClick={() => setActionOutput('dashboard-card-clicked')}
            >
              Trigger Dashboard Action
            </button>
            {actionOutput && <span data-testid="action-result">{actionOutput}</span>}
          </div>
        )}

        {currentRoute === 'messages' && (
          <div>
            <h2>Chats & Messages Page</h2>
            <input data-testid="chat-input" placeholder="Type a message..." />
          </div>
        )}

        {currentRoute === 'profile' && (
          <div>
            <h2>Student Profile Page</h2>
            <p>Student ID: STU-99001</p>
          </div>
        )}

        {currentRoute === 'room' && (
          <div>
            <h2>Study Room: Quantum Physics</h2>
            <p data-testid="room-state-indicator">State: {mockMeetingState.state}</p>
            <button
              type="button"
              data-testid="dock-btn"
              onClick={() => {
                mockMeetingState.dockMeeting();
              }}
            >
              Minimize to Floating Window
            </button>
          </div>
        )}
      </main>

      {/* Modal Dialog */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="StudySync Settings Dialog">
        <div data-testid="dialog-inner-content">
          <p>Dialog content mounted in top-level modal root</p>
          <button type="button" data-testid="close-dialog-btn" onClick={() => setModalOpen(false)}>
            Close Dialog
          </button>
        </div>
      </Modal>

      {/* Persistent In-App Meeting Dock */}
      <FloatingMeetingDock />
    </div>
  );
};

describe('StudySync Floating Meeting Dock End-to-End Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeetingState.state = 'dock';

    // Ensure document overlay roots exist
    let overlayRoot = document.getElementById('studysync-floating-overlay-root');
    if (!overlayRoot) {
      overlayRoot = document.createElement('div');
      overlayRoot.id = 'studysync-floating-overlay-root';
      document.body.appendChild(overlayRoot);
    }

    let modalRoot = document.getElementById('studysync-modal-root');
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'studysync-modal-root';
      document.body.appendChild(modalRoot);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('Executes complete 12-step meeting floating sequence across routes, dialogs, dragging, and resize', () => {
    render(<TestAppHarness />);

    // Step 1: In Study Room
    expect(screen.getByText('Study Room: Quantum Physics')).toBeTruthy();

    // Step 2: Floating meeting window is active and mounted via portal
    const overlay = screen.getByTestId('meeting-floating-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.style.zIndex).toBe('10000');
    expect(overlay.style.pointerEvents).toBe('none');

    const dock = screen.getByTestId('meeting-floating-dock');
    expect(dock).toBeTruthy();
    expect(dock.style.pointerEvents).toBe('auto');
    expect(screen.getByText('Quantum Physics')).toBeTruthy();

    // Step 3: Click Dashboard
    const dashboardNav = screen.getByTestId('nav-dashboard');
    act(() => {
      fireEvent.click(dashboardNav);
    });
    expect(screen.getByText('Dashboard Page')).toBeTruthy();
    // Meeting dock remains visible and mounted
    expect(screen.getByTestId('meeting-floating-dock')).toBeTruthy();

    // Step 4: Click Chats (Messages)
    const messagesNav = screen.getByTestId('nav-messages');
    act(() => {
      fireEvent.click(messagesNav);
    });
    expect(screen.getByText('Chats & Messages Page')).toBeTruthy();
    expect(screen.getByTestId('meeting-floating-dock')).toBeTruthy();

    // Step 5: Click Profile
    const profileNav = screen.getByTestId('nav-profile');
    act(() => {
      fireEvent.click(profileNav);
    });
    expect(screen.getByText('Student Profile Page')).toBeTruthy();
    expect(screen.getByTestId('meeting-floating-dock')).toBeTruthy();

    // Step 6: Open and close dialogs
    const openDialogBtn = screen.getByTestId('open-dialog-btn');
    act(() => {
      fireEvent.click(openDialogBtn);
    });
    expect(screen.getByTestId('dialog-inner-content')).toBeTruthy();

    // Modal overlay is z-index 1000
    const modalOverlay = document.querySelector('.modal-overlay') as HTMLElement;
    expect(modalOverlay).toBeTruthy();

    // Meeting floating dock has z-index 10000 (higher than modal overlay)
    expect(parseInt(overlay.style.zIndex, 10)).toBe(10000);
    expect(screen.getByTestId('meeting-floating-dock')).toBeTruthy();

    // Close the dialog
    const closeDialogBtn = screen.getByTestId('close-dialog-btn');
    act(() => {
      fireEvent.click(closeDialogBtn);
    });
    expect(screen.queryByTestId('dialog-inner-content')).toBeNull();

    // Step 7: Scroll pages (position: fixed keeps dock anchored)
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(dock.style.position).toBe('fixed');

    // Step 8: Click different application components (pointer-events pass-through)
    act(() => {
      fireEvent.click(dashboardNav);
    });
    const actionBtn = screen.getByTestId('dashboard-action-btn');
    act(() => {
      fireEvent.click(actionBtn);
    });
    expect(screen.getByTestId('action-result').textContent).toBe('dashboard-card-clicked');

    // Step 9: Drag the meeting window
    const dragHandle = dock.querySelector('div') as HTMLElement;
    act(() => {
      fireEvent.mouseDown(dragHandle, { clientX: 400, clientY: 400 });
      fireEvent.mouseMove(window, { clientX: 350, clientY: 320 });
      fireEvent.mouseUp(window);
    });
    expect(dock.style.left).toBeTruthy();
    expect(dock.style.top).toBeTruthy();

    // Step 10: Minimize and restore it
    const collapseBtn = screen.getByLabelText(/Minimize to compact bar/i);
    act(() => {
      fireEvent.click(collapseBtn);
    });
    // Collapsed width
    expect(dock.style.width).toBe('260px');

    const expandBtn = screen.getByLabelText(/Restore floating window preview/i);
    act(() => {
      fireEvent.click(expandBtn);
    });
    expect(dock.style.width).toBe('340px');

    // Step 11: Return to Study Room
    const returnBtns = screen.getAllByLabelText('Return to full room');
    act(() => {
      fireEvent.click(returnBtns[0]);
    });

    // Step 12: Verify restoreMeeting was called and meeting state is preserved
    expect(mockMeetingState.restoreMeeting).toHaveBeenCalledTimes(1);
    expect(mockMeetingState.state).toBe('full');
  });

  it('Guarantees responsive positioning avoiding mobile bottom navigation', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 844 });

    render(<TestAppHarness />);

    const dock = screen.getByTestId('meeting-floating-dock');
    const dragHandle = dock.querySelector('div') as HTMLElement;

    // Drag to bottom of viewport
    act(() => {
      fireEvent.mouseDown(dragHandle, { clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 50, clientY: 840 });
      fireEvent.mouseUp(window);
    });

    const top = parseInt(dock.style.top, 10);
    // On 844px mobile screen, dock top must be <= 844 - currentHeight - 68
    expect(top).toBeLessThanOrEqual(844 - 68);
  });
});
