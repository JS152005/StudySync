import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import {
  MessageSquare,
  UsersRound,
  Video,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  KeyRound,
  Clock,
  ShieldCheck,
  UserPlus,
  Plus,
} from 'lucide-react';

interface DashboardData {
  recentDirectChats: Array<{
    user_id: string;
    student_id: string;
    username: string;
    full_name: string;
    avatar_url?: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
  }>;
  myGroups: Array<{
    id: string;
    name: string;
    subject?: string;
    course?: string;
    invite_code: string;
    member_count: number;
    role: string;
  }>;
  activeHostedRooms: Array<{
    id: string;
    name: string;
    subject?: string;
    topic?: string;
    invite_code: string;
    participant_count: number;
    created_at: string;
  }>;
  pendingRoomInvitations: Array<{
    invitation_id: string;
    room_id: string;
    room_name: string;
    room_subject?: string;
    room_code: string;
    inviter_name: string;
    inviter_student_id: string;
    created_at: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await apiRequest<DashboardData>('/users/dashboard-summary');
      setData(res);
    } catch (err: any) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyStudentId = (e: React.MouseEvent) => {
    if (!user?.student_id) return;
    navigator.clipboard.writeText(user.student_id);
    triggerSparks(e, 'azure', 10);
    setCopiedId(true);
    toast.success(`Copied Student ID: ${user.student_id}`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;

    setJoiningCode(true);
    try {
      const res = await apiRequest<{ roomId: string; message: string }>('/rooms/join-by-code', {
        method: 'POST',
        body: JSON.stringify({ invite_code: quickCode.trim().toUpperCase() }),
      });
      toast.success(res.message || 'Joined private room!');
      navigate(`/rooms/${res.roomId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room. Verify the room code.');
    } finally {
      setJoiningCode(false);
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
        loadDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond to invitation');
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Skeleton height="130px" borderRadius={THEME.radius.cardLg} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <Skeleton height="320px" borderRadius={THEME.radius.card} />
          <Skeleton height="320px" borderRadius={THEME.radius.card} />
        </div>
      </div>
    );
  }

  const pendingInvites = data?.pendingRoomInvitations || [];
  const recentChats = data?.recentDirectChats || [];
  const myGroups = data?.myGroups || [];
  const hostedRooms = data?.activeHostedRooms || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Welcome & Student Identity Card */}
      <div
        className="card-featured"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          padding: '28px 32px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
          border: '1px solid #E2E8F0',
          borderTop: '3px solid #0284C7',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.card,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
              Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#0284C7',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                padding: '2px 8px',
                borderRadius: THEME.radius.pill,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={12} color="#0284C7" />
              Verified Student
            </span>
          </div>

          <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
            Connect privately with peers, create study groups, and collaborate in real-time study rooms.
          </p>

          {/* Student ID Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Your Unique Student ID:
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #0284C7',
                padding: '5px 12px',
                borderRadius: THEME.radius.pill,
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.1)',
                cursor: 'pointer',
              }}
              onClick={handleCopyStudentId}
              title="Click to copy Student ID to clipboard"
            >
              <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, color: '#0284C7', letterSpacing: '0.5px' }}>
                {user?.student_id || 'STU-XXXXXX'}
              </span>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {copiedId ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#0284C7" />}
              </button>
            </div>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
              Share this ID with peers so they can message you or invite you to study rooms.
            </span>
          </div>
        </div>

        {/* Quick Primary Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            leftIcon={<UserPlus size={15} color="#0284C7" />}
            onClick={() => navigate('/messages?action=new-chat')}
          >
            New Chat
          </Button>

          <Button
            variant="secondary"
            shape="pill"
            leftIcon={<UsersRound size={15} color="#0284C7" />}
            onClick={() => navigate('/messages?action=create-group')}
          >
            Create Group
          </Button>

          <Button
            variant="primary"
            shape="pill"
            leftIcon={<Video size={15} color="#FFFFFF" />}
            onClick={() => navigate('/rooms?action=create')}
          >
            Create Room
          </Button>
        </div>
      </div>

      {/* 2. Pending Study Room Invitations (if any) */}
      {pendingInvites.length > 0 && (
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
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1E3A8A' }}>
              Study Room Invitations ({pendingInvites.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingInvites.map((inv) => (
              <div
                key={inv.invitation_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #DBEAFE',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    {inv.inviter_name}{' '}
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                      ({inv.inviter_student_id})
                    </span>{' '}
                    invited you to join: <strong>"{inv.room_name}"</strong>
                  </div>
                  {inv.room_subject && (
                    <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                      Subject: {inv.room_subject} • Code: {inv.room_code}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    shape="pill"
                    onClick={() => handleRespondInvitation(inv.invitation_id, 'decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    shape="pill"
                    onClick={() => handleRespondInvitation(inv.invitation_id, 'accept')}
                  >
                    Accept & Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Zero-Friction Room Code Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <KeyRound size={18} color="#0284C7" />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
              Have a Room Code?
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
              Enter a private study room code shared by a host to join immediately.
            </div>
          </div>
        </div>

        <form onSubmit={handleQuickJoin} style={{ display: 'flex', gap: '8px', minWidth: '280px', flex: 1, maxWidth: '440px' }}>
          <input
            type="text"
            placeholder="e.g. ROOM-ABC123"
            value={quickCode}
            onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              border: '1.5px solid #CBD5E1',
              borderRadius: THEME.radius.pill,
              outline: 'none',
              backgroundColor: '#F8FAFC',
              textTransform: 'uppercase',
            }}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            shape="pill"
            loading={joiningCode}
            disabled={!quickCode.trim() || joiningCode}
          >
            Join Room
          </Button>
        </form>
      </div>

      {/* 4. Core Collaboration Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* RECENT CHATS */}
        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: THEME.radius.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={16} color="#0284C7" />
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Recent Chats
              </h2>
            </div>
            <NavLink
              to="/messages"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0284C7',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View all</span>
              <ArrowRight size={12} color="#0284C7" />
            </NavLink>
          </div>

          {recentChats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94A3B8' }}>
              <MessageSquare size={28} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>No messages yet</div>
              <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                Search a student by Student ID to start a conversation.
              </div>
              <Button
                variant="secondary"
                size="sm"
                shape="pill"
                style={{ marginTop: '12px' }}
                onClick={() => navigate('/messages?action=new-chat')}
              >
                Start New Chat
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentChats.map((chat) => (
                <div
                  key={chat.user_id}
                  onClick={() => navigate(`/messages?user_id=${chat.user_id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      color: '#0284C7',
                      fontWeight: 800,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {chat.full_name[0]?.toUpperCase() || 'S'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chat.full_name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '6px' }}>
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#64748B',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                        }}
                      >
                        {chat.last_message}
                      </span>
                      {chat.unread_count > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            backgroundColor: '#0284C7',
                            color: '#FFFFFF',
                            borderRadius: THEME.radius.pill,
                            padding: '1px 6px',
                          }}
                        >
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PRIVATE STUDY GROUPS */}
        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: THEME.radius.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UsersRound size={16} color="#0284C7" />
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Private Study Groups
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/messages?action=create-group')}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284C7',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: 0,
              }}
            >
              <Plus size={13} color="#0284C7" />
              <span>New Group</span>
            </button>
          </div>

          {myGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94A3B8' }}>
              <UsersRound size={28} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>No groups yet</div>
              <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                Create a private study group and add classmates by Student ID.
              </div>
              <Button
                variant="secondary"
                size="sm"
                shape="pill"
                style={{ marginTop: '12px' }}
                onClick={() => navigate('/messages?action=create-group')}
              >
                Create Study Group
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myGroups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => navigate(`/messages?group_id=${g.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {g.member_count} {g.member_count === 1 ? 'member' : 'members'} • Code: {g.invite_code}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: g.role === 'owner' ? '#0369A1' : '#64748B',
                      backgroundColor: g.role === 'owner' ? '#E0F2FE' : '#F1F5F9',
                      padding: '2px 8px',
                      borderRadius: THEME.radius.pill,
                      textTransform: 'capitalize',
                    }}
                  >
                    {g.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ACTIVE STUDY ROOMS */}
        <div
          className="card"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: THEME.radius.card,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={16} color="#0284C7" />
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Study Rooms
              </h2>
            </div>
            <NavLink
              to="/rooms"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0284C7',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Rooms Hub</span>
              <ArrowRight size={12} color="#0284C7" />
            </NavLink>
          </div>

          {hostedRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94A3B8' }}>
              <Video size={28} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>No active rooms</div>
              <div style={{ fontSize: '11.5px', marginTop: '4px' }}>
                Launch a private study room to collaborate via video, screen share, and whiteboard.
              </div>
              <Button
                variant="primary"
                size="sm"
                shape="pill"
                style={{ marginTop: '12px' }}
                onClick={() => navigate('/rooms?action=create')}
              >
                Create Study Room
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hostedRooms.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      Code: <strong style={{ fontFamily: 'monospace' }}>{r.invite_code}</strong> • {r.participant_count} active
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    shape="pill"
                    onClick={() => navigate(`/rooms/${r.id}`)}
                  >
                    Rejoin Room
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
