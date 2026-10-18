import React, { useState, useEffect } from 'react';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Video, Plus, Users, GraduationCap, ArrowRight } from 'lucide-react';

export const Rooms: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultGroupId = searchParams.get('group_id') || '';

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Room Modal
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSubject, setRoomSubject] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [teachMode, setTeachMode] = useState(false);

  const loadRooms = async () => {
    try {
      const data = await apiRequest<{ rooms: any[] }>('/rooms');
      setRooms(data.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
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
      navigate(`/rooms/${res.room.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Live Study Rooms</h1>
          <p style={{ fontSize: '13px' }}>Real-time peer study spaces with WebRTC video, screen sharing, collaborative whiteboards, and doubt queues.</p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} color="#FFFFFF" />
          <span>Create Study Room</span>
        </button>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="card" style={{ padding: '36px', textAlign: 'center' }}>Loading active rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="card-secondary" style={{ textAlign: 'center', padding: '48px' }}>
          <Video size={40} color="#E6E6FA" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No active study rooms right now</div>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Start an instant study room to collaborate on exam topics, share your screen, or teach a peer!
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <span>Launch Study Room</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {rooms.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {r.teach_mode === 1 && (
                      <span className="badge" style={{ gap: '4px' }}>
                        <GraduationCap size={12} color="#FFFFFF" />
                        Teach Mode
                      </span>
                    )}
                    <span className="badge-outline">Live</span>
                  </div>
                  <span style={{ fontSize: '12px' }}>{r.participant_count} student{r.participant_count === 1 ? '' : 's'}</span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '4px' }}>{r.name}</h3>
                <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                  {r.subject ? `${r.subject} • ` : ''}{r.topic || 'General Discussion'}
                </div>
                <div style={{ fontSize: '11px' }}>Host: {r.host_name}</div>
              </div>

              <NavLink to={`/rooms/${r.id}`} className="btn-primary" style={{ width: '100%' }}>
                <span>Enter Room</span>
                <ArrowRight size={14} color="#FFFFFF" />
              </NavLink>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Launch Study Room</h2>
            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g. DBMS Normalization Live Study"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Database Management Systems"
                  value={roomSubject}
                  onChange={(e) => setRoomSubject(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Topic</label>
                <input
                  type="text"
                  placeholder="e.g. 1NF, 2NF, 3NF & BCNF"
                  value={roomTopic}
                  onChange={(e) => setRoomTopic(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="teachMode"
                  checked={teachMode}
                  onChange={(e) => setTeachMode(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="teachMode" style={{ fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  Enable Teach Mode (Dedicated presenter layout with hand-raising and doubt queue)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Launch Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
