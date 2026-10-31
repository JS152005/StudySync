import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VideoMeeting, Participant } from '../components/VideoMeeting';
import { useMeeting } from '../context/MeetingContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import {
  Lock,
  Copy,
  Check,
  UserPlus,
  Users,
  Search,
  UserMinus,
  Hand,
  PhoneOff,
  Sparkles,
  Shield,
  X,
  Volume2,
  Video as VideoIcon,
  Mic,
} from 'lucide-react';

export const RoomSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const inviteCodeQuery = (searchParams.get('code') || '').trim();
  const { user } = useAuth();
  const meeting = useMeeting();
  const navigate = useNavigate();
  const toast = useToast();

  const [roomData, setRoomData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Add Student by Student ID state
  const [searchStudentId, setSearchStudentId] = useState('');
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [foundStudent, setFoundStudent] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Participant removal state
  const [participantToRemove, setParticipantToRemove] = useState<any>(null);
  const [removingParticipant, setRemovingParticipant] = useState(false);

  const loadRoom = async () => {
    if (!id) return;
    try {
      const query = inviteCodeQuery ? `?code=${encodeURIComponent(inviteCodeQuery)}` : '';
      const data = await apiRequest(`/rooms/${id}${query}`);
      setRoomData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load private study room');
      navigate('/rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const body = inviteCodeQuery ? { invite_code: inviteCodeQuery } : {};
    apiRequest(`/rooms/${id}/join`, { method: 'POST', body: JSON.stringify(body) })
      .then(() => loadRoom())
      .catch(console.error);

    // Register active room in application-level meeting context and ensure unminimized
    meeting.joinRoom(id);
    meeting.setMinimized(false);

    const interval = setInterval(loadRoom, 5000);
    return () => {
      clearInterval(interval);
      // Navigation away from /rooms/:id does NOT leave the meeting!
      // The meeting continues persistently in the background like Google Meet.
    };
  }, [id, inviteCodeQuery]);

  const handleCopyInvite = () => {
    if (!roomData?.room?.invite_code) return;
    const code = roomData.room.invite_code;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(`Copied room code: ${code}`);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleToggleHand = async () => {
    try {
      await apiRequest(`/rooms/${id}/hand`, { method: 'POST' });
      loadRoom();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLeave = async () => {
    await meeting.leaveRoom();
  };

  const handleEndRoom = async () => {
    setEnding(true);
    try {
      await meeting.endRoom();
      toast.info('Study session concluded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEnding(false);
      setShowEndModal(false);
    }
  };

  // Search student by Student ID
  const handleSearchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = searchStudentId.trim();
    if (!cleanId) return;

    setSearchingStudent(true);
    setSearchError('');
    setFoundStudent(null);

    try {
      const res = await apiRequest<{ student: any }>(`/users/by-student-id/${encodeURIComponent(cleanId)}`);
      if (res.student) {
        setFoundStudent(res.student);
      } else {
        setSearchError('No student found with Student ID: ' + cleanId);
      }
    } catch (err: any) {
      setSearchError(err.message || 'No student found with that Student ID');
    } finally {
      setSearchingStudent(false);
    }
  };

  // Send invitation to found student
  const handleSendInvite = async () => {
    if (!foundStudent?.student_id) return;
    setSendingInvite(true);
    try {
      await apiRequest(`/rooms/${id}/invite-student`, {
        method: 'POST',
        body: JSON.stringify({ student_id: foundStudent.student_id }),
      });
      toast.success(`Invitation sent to ${foundStudent.full_name} (${foundStudent.student_id})!`);
      setShowInviteModal(false);
      setFoundStudent(null);
      setSearchStudentId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send room invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // Host removal of participant
  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return;
    setRemovingParticipant(true);
    try {
      await apiRequest(`/rooms/${id}/participants/${participantToRemove.user_id}`, {
        method: 'DELETE',
      });
      toast.success(`Removed ${participantToRemove.full_name} from study room`);
      setParticipantToRemove(null);
      loadRoom();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove participant');
    } finally {
      setRemovingParticipant(false);
    }
  };

  if (loading || !roomData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height="70px" borderRadius={THEME.radius.card} />
        <Skeleton height="600px" borderRadius={THEME.radius.card} />
      </div>
    );
  }

  const { room, isHost, participants } = roomData;

  // Authoritative logical participant deduplication by user_id
  const rawParticipants = (meeting.authoritativeParticipants && meeting.authoritativeParticipants.length > 0)
    ? meeting.authoritativeParticipants
    : (participants || []);

  const uniqueParticipantsMap = new Map<string, Participant>();
  rawParticipants.forEach((p: Participant) => {
    if (p.user_id && !uniqueParticipantsMap.has(p.user_id)) {
      uniqueParticipantsMap.set(p.user_id, p);
    }
  });
  const uniqueParticipants = Array.from(uniqueParticipantsMap.values());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Google Meet Top Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.card,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="live-pulse-dot" />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284C7',
                  padding: '2px 8px',
                  borderRadius: THEME.radius.pill,
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                <Lock size={11} color="#0284C7" />
                Private Room
              </span>
              {isHost && (
                <span
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: THEME.radius.pill,
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Host
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0 0', color: '#0F172A' }}>
              {room.name}
            </h1>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              {room.subject ? `${room.subject} • ` : ''}
              {room.topic || 'Peer Study'} • Hosted by {room.host_name}
            </div>
          </div>
        </div>

        {/* Action Group: Share Code & Add Student */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {room.invite_code && (
            <button
              type="button"
              onClick={handleCopyInvite}
              style={{
                background: copiedCode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(2, 132, 199, 0.08)',
                border: `1.5px solid ${copiedCode ? '#10B981' : 'rgba(2, 132, 199, 0.3)'}`,
                borderRadius: THEME.radius.pill,
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 800,
                color: copiedCode ? '#059669' : '#0284C7',
                fontFamily: 'monospace',
                transition: 'all 0.15s ease',
              }}
              title="Copy private invite code to clipboard"
            >
              {copiedCode ? <Check size={14} color="#059669" /> : <Copy size={14} color="#0284C7" />}
              <span>CODE: {room.invite_code}</span>
            </button>
          )}

          <Button
            variant="primary"
            size="sm"
            shape="pill"
            leftIcon={<UserPlus size={14} color="#FFFFFF" />}
            onClick={() => {
              setSearchStudentId('');
              setFoundStudent(null);
              setSearchError('');
              setShowInviteModal(true);
            }}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* Main Workspace: Google Meet Screen & Participants Drawer */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch', width: '100%', position: 'relative' }}>
        {/* Google Meet Center Video & Collaboration Canvas */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <VideoMeeting
            roomId={room.id}
            roomName={room.name}
            isHost={isHost}
            participants={uniqueParticipants}
            onInviteStudent={() => {
              setSearchStudentId('');
              setFoundStudent(null);
              setSearchError('');
              setShowInviteModal(true);
            }}
            onToggleHand={handleToggleHand}
            onLeave={handleLeave}
            onEndRoom={isHost ? () => setShowEndModal(true) : undefined}
          />
        </div>

        {/* Slide-out Participants Drawer */}
        {meeting.showParticipants && (
          <div
            className="card"
            style={{
              width: '320px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.cardLg,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '16px',
              flexShrink: 0,
              boxShadow: THEME.shadow.lifted,
              animation: 'studysync-slide-in 0.2s ease',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#0284C7" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Participants ({uniqueParticipants.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => meeting.setShowParticipants(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Add Student Button */}
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              leftIcon={<UserPlus size={13} color="#0F172A" />}
              onClick={() => {
                setSearchStudentId('');
                setFoundStudent(null);
                setSearchError('');
                setShowInviteModal(true);
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Invite by Student ID
            </Button>

            {/* Participant List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '500px' }}>
              {uniqueParticipants.map((p: Participant) => {
                const isCurrentHost = room.host_id === p.user_id;
                const isMe = user?.id === p.user_id;

                return (
                  <div
                    key={p.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: isMe ? 'rgba(2, 132, 199, 0.05)' : '#F8FAFC',
                      borderRadius: THEME.radius.md,
                      border: `1.5px solid ${p.is_hand_raised === 1 ? 'rgba(244, 63, 94, 0.6)' : isMe ? 'rgba(2, 132, 199, 0.3)' : '#E2E8F0'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: '#0F172A',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {(p.full_name || 'S')[0]?.toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.full_name}
                          </span>
                          {isCurrentHost && (
                            <span
                              style={{
                                backgroundColor: '#0284C7',
                                color: '#FFFFFF',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: THEME.radius.pill,
                              }}
                            >
                              Host
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          @{p.username} {isMe && '(You)'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.is_hand_raised === 1 && (
                        <span
                          title="Hand raised"
                          style={{
                            backgroundColor: 'rgba(244, 63, 94, 0.15)',
                            padding: '3px 6px',
                            borderRadius: THEME.radius.pill,
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Hand size={12} color="#F43F5E" />
                        </span>
                      )}

                      {/* Host Remove Participant Action */}
                      {isHost && !isMe && !isCurrentHost && (
                        <button
                          type="button"
                          onClick={() => setParticipantToRemove(p)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease',
                          }}
                          title={`Remove ${p.full_name} from study room`}
                        >
                          <UserMinus size={14} color="#EF4444" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal (Search by Student ID) */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Student to Study Room"
        description="Search for a student using their unique Student ID to send them a private room invitation."
        maxWidth="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <form onSubmit={handleSearchStudent} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Enter Student ID (e.g. STU-1234)"
                value={searchStudentId}
                onChange={(e) => setSearchStudentId(e.target.value.toUpperCase())}
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: THEME.radius.control,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
              />
              <Search
                size={14}
                color="#94A3B8"
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
            <Button type="submit" variant="primary" size="md" loading={searchingStudent}>
              Search
            </Button>
          </form>

          {searchError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: THEME.radius.control,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {searchError}
            </div>
          )}

          {foundStudent && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                borderRadius: THEME.radius.md,
                border: '1.5px solid #0284C7',
                backgroundColor: 'rgba(2, 132, 199, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#0F172A',
                    color: '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 800,
                  }}
                >
                  {(foundStudent.full_name || 'S')[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                    {foundStudent.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    ID: <strong style={{ color: '#0284C7', fontFamily: 'monospace' }}>{foundStudent.student_id}</strong>
                  </div>
                  {foundStudent.major && (
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{foundStudent.major}</div>
                  )}
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                shape="pill"
                onClick={handleSendInvite}
                loading={sendingInvite}
                leftIcon={<UserPlus size={13} color="#FFFFFF" />}
              >
                Send Invite
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Participant Modal */}
      <Modal
        isOpen={!!participantToRemove}
        onClose={() => setParticipantToRemove(null)}
        title="Remove Participant?"
        description={`Are you sure you want to remove ${participantToRemove?.full_name} from this private study room?`}
        maxWidth="440px"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setParticipantToRemove(null)}>
            Cancel
          </Button>
          <Button variant="vermilion" onClick={handleRemoveParticipant} loading={removingParticipant}>
            Remove from Room
          </Button>
        </div>
      </Modal>

      {/* End Room Confirmation Modal */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Study Session?"
        description="This will immediately conclude the live room and disconnect all participants."
        maxWidth="440px"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowEndModal(false)}>
            Stay in Room
          </Button>
          <Button variant="vermilion" onClick={handleEndRoom} loading={ending}>
            End Room for Everyone
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RoomSession;
