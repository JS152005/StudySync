export type MeetingState =
  | 'idle'
  | 'joining'
  | 'full'
  | 'dock'
  | 'restoring'
  | 'disconnected'
  | 'ended'
  | 'pip';

export type MeetingEvent =
  | { type: 'JOIN_START' }
  | { type: 'JOIN_SUCCESS' }
  | { type: 'NAVIGATE_AWAY' }
  | { type: 'DOCK' }
  | { type: 'RESTORE' }
  | { type: 'RESTORE_SUCCESS' }
  | { type: 'DISCONNECTED' }
  | { type: 'RECONNECTED'; target?: 'full' | 'dock' | 'pip' }
  | { type: 'ROOM_ENDED' }
  | { type: 'LEAVE' }
  | { type: 'RESET' }
  | { type: 'PIP' }
  | { type: 'PIP_CLOSED' };

/**
 * Pure state machine transition function for StudySync meeting lifecycles.
 * Handles explicit states: idle, joining, full, dock, restoring, disconnected, ended, pip.
 */
export function transitionMeetingState(current: MeetingState, event: MeetingEvent): MeetingState {
  switch (current) {
    case 'idle':
      if (event.type === 'JOIN_START') return 'joining';
      return current;

    case 'joining':
      if (event.type === 'JOIN_SUCCESS') return 'full';
      if (event.type === 'NAVIGATE_AWAY' || event.type === 'DOCK') return 'dock';
      if (event.type === 'DISCONNECTED') return 'disconnected';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'full':
      if (event.type === 'PIP') return 'pip';
      if (event.type === 'NAVIGATE_AWAY' || event.type === 'DOCK') return 'dock';
      if (event.type === 'DISCONNECTED') return 'disconnected';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'dock':
      if (event.type === 'PIP') return 'pip';
      if (event.type === 'RESTORE') return 'restoring';
      if (event.type === 'RESTORE_SUCCESS') return 'full';
      if (event.type === 'DISCONNECTED') return 'disconnected';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'pip':
      if (event.type === 'RESTORE') return 'restoring';
      if (event.type === 'RESTORE_SUCCESS') return 'full';
      // Closing the PiP window must NEVER leave the room — always transitions to dock
      if (event.type === 'PIP_CLOSED' || event.type === 'DOCK' || event.type === 'NAVIGATE_AWAY') return 'dock';
      if (event.type === 'DISCONNECTED') return 'disconnected';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'restoring':
      if (event.type === 'RESTORE_SUCCESS') return 'full';
      if (event.type === 'PIP') return 'pip';
      if (event.type === 'NAVIGATE_AWAY' || event.type === 'DOCK') return 'dock';
      if (event.type === 'DISCONNECTED') return 'disconnected';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'disconnected':
      if (event.type === 'RECONNECTED') return event.target || 'full';
      if (event.type === 'JOIN_START') return 'joining';
      if (event.type === 'ROOM_ENDED' || event.type === 'LEAVE') return 'ended';
      if (event.type === 'RESET') return 'idle';
      return current;

    case 'ended':
      if (event.type === 'RESET' || event.type === 'LEAVE') return 'idle';
      if (event.type === 'JOIN_START') return 'joining';
      return current;

    default:
      return current;
  }
}
