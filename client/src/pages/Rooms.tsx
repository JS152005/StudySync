import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import {
  Video,
  KeyRound,
  Plus,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  Copy,
  Check,
  Lock,
} from 'lucide-react';

export const Rooms: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const autoCreate = searchParams.get('action') === 'create';

  // Join Room by Code state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Create Room Modal state
  const [showCreateModal, setShowCreateModal] = useState(autoCreate);
  const [roomName, setRoomName] = useState('');
  const [roomSubject, setRoomSubject] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [creating, setCreating] = useState(false);

  // Active hosted rooms and invitations
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [roomsRes, invRes] = await Promise.all([
        apiRequest<{ rooms: any[] }>('/rooms'),
        apiRequest<{ invitations: any[] }>('/rooms/invitations'),
      ]);
      setHostedRooms(roomsRes.rooms || []);
      setInvitations(invRes.invitations || []);
    } catch (err: any) {
      console.error('Rooms load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) return;

    setJoining(true);
    try {
      const res = await apiRequest<{ roomId: string; message: string }>('/rooms/join-by-code', {
        method: 'POST',
        body: JSON.stringify({ invite_code: cleanCode }),
      });
      toast.success(res.message || 'Joined private study room!');
      navigate(`/rooms/${res.roomId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room. Verify the room code.');
    } finally {
      setJoining(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setCreating(true);
    try {
      const res = await apiRequest<{ room: any }>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName.trim(),
          subject: roomSubject.trim(),
          topic: roomTopic.trim(),
        }),
      });
      toast.success('Study room created!');
      navigate(`/rooms/${res.room.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    try {
      const res = await apiRequest<{ roomId?: string; message: string }>(
        `/rooms/invitations/${invitationId}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        }
      );
      toast.success(res.message);
      if (action === 'accept' && res.roomId) {
        navigate(`/rooms/${res.roomId}`);
      } else {
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond to invitation');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Video size={22} color="#0284C7" />
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Private Study Rooms
          </h1>
        </div>
        <p style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px', margin: 0, lineHeight: 1.5 }}>
          Google Meet-style private collaboration spaces with real camera, microphone, screen sharing, and a synchronized whiteboard.
        </p>
      </div>

      {/* Pending Room Invitations Banner (if any) */}
      {invitations.length > 0 && (
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1.5px solid #BFDBFE',
            borderRadius: THEME.radius.card,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#0284C7" />
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E3A8A' }}>
              Pending Room Invitations ({invitations.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #DBEAFE',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    {inv.inviter_name}{' '}
                    <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                      ({inv.inviter_student_id})
                    </span>{' '}
                    invited you to join: <strong>"{inv.room_name}"</strong>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    {inv.room_subject ? `Subject: ${inv.room_subject} • ` : ''}Room Code: <strong>{inv.room_code}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    shape="pill"
                    onClick={() => handleRespondInvitation(inv.id, 'decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    shape="pill"
                    onClick={() => handleRespondInvitation(inv.id, 'accept')}
                  >
                    Accept & Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* THE TWO PRIMARY ACTIONS (Exact Spec Requirement)               */}
      {/* 1. Join with Code                                              */}
      {/* 2. Create Room                                                 */}
      {/* ============================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Action 1: Join with Code */}
        <div
          className="card"
          style={{
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: THEME.radius.cardLg,
            boxShadow: THEME.shadow.card,
          }}
        >
          <div>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <KeyRound size={22} color="#0284C7" />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Join with Code
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.5 }}>
              Enter the private room code shared by the session host to join their live room immediately.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="e.g. ROOM-ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{
                padding: '11px 16px',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 700,
                color: '#0F172A',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                outline: 'none',
                backgroundColor: '#F8FAFC',
                textTransform: 'uppercase',
                boxSizing: 'border-box',
                width: '100%',
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              size="md"
              shape="pill"
              loading={joining}
              disabled={!joinCode.trim() || joining}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Join Room</span>
              <ArrowRight size={14} color="#0284C7" />
            </Button>
          </form>
        </div>

        {/* Action 2: Create Room */}
        <div
          className="card"
          style={{
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #0284C7',
            borderRadius: THEME.radius.cardLg,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
          }}
        >
          <div>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Video size={22} color="#FFFFFF" />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Create Room
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.5 }}>
              Launch a secure private study room. You become its host and can invite peers via their unique Student ID or private room code.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            shape="pill"
            leftIcon={<Plus size={16} color="#FFFFFF" />}
            onClick={() => setShowCreateModal(true)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            New Study Room
          </Button>
        </div>
      </div>

      {/* Active Hosted Rooms (by current user) */}
      {hostedRooms.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Your Active Rooms ({hostedRooms.length})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {hostedRooms.map((room) => (
              <div
                key={room.id}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: THEME.radius.card,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    {room.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    Code: <strong style={{ fontFamily: 'monospace', color: '#0284C7' }}>{room.invite_code}</strong> • {room.participant_count} active
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  shape="pill"
                  onClick={() => navigate(`/rooms/${room.id}`)}
                >
                  Enter Room
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Private Study Room"
          maxWidth="480px"
        >
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Room Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Distributed Consensus & Raft Paper"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Subject / Course (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={roomSubject}
                onChange={(e) => setRoomSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Topic Focus (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Chapter 4 Practice Problems"
                value={roomTopic}
                onChange={(e) => setRoomTopic(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                shape="pill"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                shape="pill"
                loading={creating}
                disabled={!roomName.trim() || creating}
              >
                Create Room
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Rooms;
