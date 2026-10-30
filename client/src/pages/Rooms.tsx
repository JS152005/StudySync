import React, { useState, useEffect } from 'react';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import { Video, Plus, GraduationCap, ArrowRight, Users, KeyRound, Copy, Check, Lock } from 'lucide-react';

export const Rooms: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const defaultGroupId = searchParams.get('group_id') || '';
  const autoCreate = searchParams.get('action') === 'create';

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Join Room by Code Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Create Room Modal
  const [showModal, setShowModal] = useState(autoCreate);
  const [roomName, setRoomName] = useState('');
  const [roomSubject, setRoomSubject] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [teachMode, setTeachMode] = useState(false);

  const loadRooms = async () => {
    try {
      const data = await apiRequest<{ rooms: any[] }>('/rooms');
      setRooms(data.rooms);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoCreate) {
      setShowModal(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [autoCreate]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ room: any }>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName,
          subject: roomSubject,
          topic: roomTopic,
          group_id: groupId || null,
          teach_mode: teachMode,
        }),
      });
      toast.success('Study Room launched!');
      navigate(`/rooms/${res.room.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    triggerSparks(e, 'azure', 8);
    toast.success(`Copied invite code: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await apiRequest<{ roomId: string; message: string }>('/rooms/join-by-code', {
        method: 'POST',
        body: JSON.stringify({ invite_code: joinCode.trim().toUpperCase() }),
      });
      toast.success(res.message || 'Joined private room!');
      setShowJoinModal(false);
      setJoinCode('');
      navigate(`/rooms/${res.roomId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room. Verify the invite code.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
            Private Study Rooms
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
            Real-time peer spaces with video collaboration, screen sharing, whiteboards, and doubt queues.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            leftIcon={<KeyRound size={15} color="#94A3B8" />}
            onClick={() => setShowJoinModal(true)}
          >
            Join with Code
          </Button>
          <Button
            variant="primary"
            shape="pill"
            leftIcon={<Plus size={16} color="#FFFFFF" />}
            onClick={() => setShowModal(true)}
          >
            Create Private Room
          </Button>
        </div>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          <Skeleton height="180px" borderRadius={THEME.radius.card} />
          <Skeleton height="180px" borderRadius={THEME.radius.card} />
          <Skeleton height="180px" borderRadius={THEME.radius.card} />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<Video size={32} />}
          title="No active private study rooms right now"
          description="Launch an invite-only study room for your peers or enter an invitation code to join an active session."
          action={
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="secondary" shape="pill" onClick={() => setShowJoinModal(true)}>
                Enter Invite Code
              </Button>
              <Button
                variant="primary"
                shape="pill"
                onClick={(e) => {
                  triggerSparks(e, 'azure', 10);
                  setShowModal(true);
                }}
              >
                Launch Private Room
              </Button>
            </div>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {rooms.map((r) => (
            <div
              key={r.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: THEME.radius.card,
                padding: '22px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="live-pulse-dot" />
                    <span className="badge" style={{ gap: '4px', fontSize: '10.5px' }}>
                      <Lock size={11} color="#38BDF8" />
                      Private
                    </span>
                    {r.teach_mode === 1 && (
                      <span className="badge-outline" style={{ gap: '4px', fontSize: '10.5px' }}>
                        <GraduationCap size={12} color="#0EA5E9" />
                        Teach Mode
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Users size={13} color="#64748B" />
                    <span>
                      {r.participant_count} student{r.participant_count === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '16.5px',
                    fontWeight: 700,
                    marginBottom: '4px',
                    color: '#F8FAFC',
                  }}
                >
                  {r.name}
                </h3>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: '#64748B' }}>
                  {r.subject ? `${r.subject} • ` : ''}
                  {r.topic || 'General Discussion'}
                </div>
                <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Host: {r.host_name}</div>

                {/* Private Invite Code Tag with Copy Button */}
                {r.invite_code && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '6px 10px',
                      backgroundColor: 'rgba(14, 165, 233, 0.1)',
                      borderRadius: THEME.radius.sm,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px dashed rgba(14, 165, 233, 0.35)',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em' }}>
                      CODE: {r.invite_code}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(r.invite_code, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        color: '#38BDF8',
                        fontWeight: 600,
                      }}
                      title="Copy invite code"
                    >
                      {copiedCode === r.invite_code ? <Check size={12} color="#38BDF8" /> : <Copy size={12} color="#38BDF8" />}
                      <span>{copiedCode === r.invite_code ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              <NavLink
                to={`/rooms/${r.id}`}
                className="btn-primary btn-pill"
                style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
                onClick={(e) => triggerSparks(e, 'azure', 10)}
              >
                <span>Enter Private Room</span>
                <ArrowRight size={14} color="#FFFFFF" />
              </NavLink>
            </div>
          ))}
        </div>
      )}

      {/* Accessible Create Room Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Launch Study Room"
        description="Collaborate in real time with classmates via audio, video, whiteboards, and doubts."
      >
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
              }}
            >
              Room Name *
            </label>
            <input
              type="text"
              placeholder="e.g. DBMS Normalization Live Study"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
              }}
            >
              Subject
            </label>
            <input
              type="text"
              placeholder="e.g. Database Management Systems"
              value={roomSubject}
              onChange={(e) => setRoomSubject(e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
              }}
            >
              Topic
            </label>
            <input
              type="text"
              placeholder="e.g. 1NF, 2NF, 3NF & BCNF"
              value={roomTopic}
              onChange={(e) => setRoomTopic(e.target.value)}
            />
          </div>

          {/* Animated ToggleSwitch for Teach Mode */}
          <div
            style={{
              padding: '12px',
              borderRadius: THEME.radius.md,
              border: `1px solid ${teachMode ? '#0EA5E9' : 'rgba(255, 255, 255, 0.1)'}`,
              backgroundColor: '#121929',
              transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
            }}
          >
            <ToggleSwitch
              id="teach-mode-toggle"
              checked={teachMode}
              onChange={setTeachMode}
              label="Enable Teach Mode"
              description="Dedicated presenter layout with hand-raising queue, attendee doubts, and structured agenda."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Launch Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Join Private Room with Invite Code Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Join Private Study Room"
        description="Enter the secret room invite code shared by your study partner or classmate."
      >
        <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
              }}
            >
              Private Room Invite Code *
            </label>
            <input
              type="text"
              placeholder="e.g. ROOM-A1B2C3"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              required
              autoFocus
              style={{
                letterSpacing: '0.08em',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            />
          </div>

          <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
            StudySync rooms are private peer spaces. Only participants with the room's invite code can join.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={joining}>
              Join Private Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Rooms;
