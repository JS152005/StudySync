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
import { Video, Plus, GraduationCap, ArrowRight, Users, Sparkles } from 'lucide-react';

export const Rooms: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const defaultGroupId = searchParams.get('group_id') || '';
  const autoCreate = searchParams.get('action') === 'create';

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      // Clean query param
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Live Study Rooms
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Real-time peer study spaces with WebRTC video, screen sharing, collaborative whiteboards, and doubt queues.
          </p>
        </div>

        <Button
          variant="primary"
          shape="pill"
          leftIcon={<Plus size={16} color={THEME.warmIvory} />}
          onClick={() => setShowModal(true)}
        >
          Create Study Room
        </Button>
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
          title="No active study rooms right now"
          description="Start an instant study room to collaborate on exam topics, share your screen, or teach a peer!"
          action={
            <Button variant="primary" shape="pill" onClick={() => setShowModal(true)}>
              Launch Study Room
            </Button>
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
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                borderRadius: THEME.radius.card,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="live-pulse-dot" />
                    <span className="badge-outline" style={{ fontSize: '10.5px' }}>
                      Live
                    </span>
                    {r.teach_mode === 1 && (
                      <span className="badge" style={{ gap: '4px', fontSize: '10.5px' }}>
                        <GraduationCap size={12} color={THEME.warmIvory} />
                        Teach Mode
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      color: THEME.warmStone,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Users size={13} color={THEME.warmStone} />
                    <span>
                      {r.participant_count} student{r.participant_count === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '16.5px',
                    fontWeight: 800,
                    marginBottom: '4px',
                    color: THEME.deepForestCharcoal,
                  }}
                >
                  {r.name}
                </h3>
                <div style={{ fontSize: '12.5px', marginBottom: '8px', color: THEME.warmStone }}>
                  {r.subject ? `${r.subject} • ` : ''}
                  {r.topic || 'General Discussion'}
                </div>
                <div style={{ fontSize: '11.5px', color: THEME.warmStone }}>Host: {r.host_name}</div>
              </div>

              <NavLink
                to={`/rooms/${r.id}`}
                className="btn-primary btn-pill"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Enter Room</span>
                <ArrowRight size={14} color={THEME.warmIvory} />
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
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
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
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
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
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
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

          {/* Polished Animated ToggleSwitch for Teach Mode */}
          <div
            style={{
              padding: '12px',
              borderRadius: THEME.radius.md,
              border: `1.5px solid ${teachMode ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
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
    </div>
  );
};

export default Rooms;
