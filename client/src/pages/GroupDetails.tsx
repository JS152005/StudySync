import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DoubtQueue } from '../components/DoubtQueue';
import { THEME } from '../theme';
import {
  Video,
  ListTodo,
  Timer,
  FolderOpen,
  Mail,
  LogOut,
  Megaphone,
  Plus,
} from 'lucide-react';

export const GroupDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'doubts' | 'members'>('overview');

  // Announcement Modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const loadGroup = async () => {
    try {
      const data = await apiRequest(`/groups/${id}`);
      setGroupData(data);
    } catch (err: any) {
      alert(err.message);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [id]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/groups/${id}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ title: annTitle, content: annContent }),
      });
      setShowAnnounceModal(false);
      setAnnTitle('');
      setAnnContent('');
      loadGroup();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/groups/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      alert(`Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this study group?')) return;
    try {
      await apiRequest(`/groups/${id}/leave`, { method: 'POST' });
      navigate('/groups');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading || !groupData) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', color: THEME.warmStone }}>
        Loading group workspace...
      </div>
    );
  }

  const { group, membership, members, announcements, activeRooms } = groupData;
  const isOwnerOrMod = membership?.role === 'owner' || membership?.role === 'moderator';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Group Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '24px',
          backgroundColor: THEME.warmIvory,
          border: `2px solid ${THEME.emeraldGreen}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge">{membership?.role || 'Member'}</span>
              <span className="badge-outline">Code: {group.invite_code}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              {group.name}
            </h1>
            <p style={{ fontSize: '13px', color: THEME.warmStone }}>
              {group.subject ? `${group.subject} • ` : ''}{group.course || 'Study Group'} • {members.length} member{members.length === 1 ? '' : 's'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowInviteModal(true)} className="btn-secondary">
              <Mail size={14} color={THEME.deepForestCharcoal} />
              <span>Invite Member</span>
            </button>
            <NavLink to={`/rooms?group_id=${group.id}`} className="btn-primary">
              <Video size={14} color={THEME.warmIvory} />
              <span>Start Room</span>
            </NavLink>
            <button onClick={handleLeave} className="btn-secondary" title="Leave Group">
              <LogOut size={14} color={THEME.deepForestCharcoal} />
            </button>
          </div>
        </div>

        {group.description && (
          <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: THEME.deepForestCharcoal }}>
            {group.description}
          </p>
        )}

        {/* Quick Collaboration Links */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            paddingTop: '10px',
            borderTop: `1px solid ${THEME.warmStone}`,
          }}
        >
          <NavLink to={`/syllabus?group_id=${group.id}`} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <ListTodo size={14} color={THEME.deepForestCharcoal} />
            <span>Syllabus Board</span>
          </NavLink>
          <NavLink to={`/focus?group_id=${group.id}`} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <Timer size={14} color={THEME.deepForestCharcoal} />
            <span>Group Focus Pact</span>
          </NavLink>
          <NavLink to={`/resources?group_id=${group.id}`} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <FolderOpen size={14} color={THEME.deepForestCharcoal} />
            <span>Shared Resources</span>
          </NavLink>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: `1.5px solid ${THEME.deepForestCharcoal}`,
          paddingBottom: '8px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            backgroundColor: activeTab === 'overview' ? THEME.emeraldGreen : THEME.warmIvory,
            color: activeTab === 'overview' ? THEME.warmIvory : THEME.deepForestCharcoal,
            borderColor: activeTab === 'overview' ? THEME.emeraldGreen : THEME.deepForestCharcoal,
            fontSize: '13px',
          }}
        >
          Overview & Announcements
        </button>
        <button
          onClick={() => setActiveTab('doubts')}
          style={{
            backgroundColor: activeTab === 'doubts' ? THEME.emeraldGreen : THEME.warmIvory,
            color: activeTab === 'doubts' ? THEME.warmIvory : THEME.deepForestCharcoal,
            borderColor: activeTab === 'doubts' ? THEME.emeraldGreen : THEME.deepForestCharcoal,
            fontSize: '13px',
          }}
        >
          Group Doubt Queue
        </button>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            backgroundColor: activeTab === 'members' ? THEME.emeraldGreen : THEME.warmIvory,
            color: activeTab === 'members' ? THEME.warmIvory : THEME.deepForestCharcoal,
            borderColor: activeTab === 'members' ? THEME.emeraldGreen : THEME.deepForestCharcoal,
            fontSize: '13px',
          }}
        >
          Members Directory ({members.length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Study Rooms */}
          {activeRooms.length > 0 && (
            <div className="card" style={{ border: `1.5px solid ${THEME.deepForestCharcoal}` }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: THEME.deepForestCharcoal }}>
                Active Study Rooms Now
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeRooms.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: THEME.warmIvory,
                      borderRadius: '6px',
                      border: `1px solid ${THEME.deepForestCharcoal}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{r.name}</div>
                      <div style={{ fontSize: '12px', color: THEME.warmStone }}>Host: {r.host_name} • {r.subject}</div>
                    </div>
                    <NavLink to={`/rooms/${r.id}`} className="btn-primary">
                      <span>Join Room</span>
                    </NavLink>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Announcements */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: `1.5px solid ${THEME.deepForestCharcoal}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} color={THEME.emeraldGreen} />
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  Group Announcements
                </h2>
              </div>
              {isOwnerOrMod && (
                <button onClick={() => setShowAnnounceModal(true)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Plus size={14} color={THEME.deepForestCharcoal} />
                  <span>Post Announcement</span>
                </button>
              )}
            </div>

            {announcements.length === 0 ? (
              <div style={{ fontSize: '13px', textAlign: 'center', padding: '20px', color: THEME.warmStone }}>
                No announcements posted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {announcements.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '14px',
                      backgroundColor: THEME.warmIvory,
                      borderRadius: '6px',
                      border: `1px solid ${THEME.deepForestCharcoal}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{a.title}</h3>
                      <span style={{ fontSize: '11px', color: THEME.warmStone }}>{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '8px', color: THEME.deepForestCharcoal }}>{a.content}</p>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: THEME.warmStone }}>Posted by {a.author_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Doubt Queue */}
      {activeTab === 'doubts' && (
        <DoubtQueue groupId={group.id} isHost={isOwnerOrMod} />
      )}

      {/* Tab 3: Members Directory */}
      {activeTab === 'members' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: `1.5px solid ${THEME.deepForestCharcoal}` }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Group Members ({members.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((m: any) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${THEME.deepForestCharcoal}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: THEME.emeraldGreen,
                      color: THEME.warmIvory,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    }}
                  >
                    {m.full_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{m.full_name}</div>
                    <div style={{ fontSize: '11px', color: THEME.warmStone }}>@{m.username} • {m.course || 'Student'}</div>
                  </div>
                </div>

                <span className="badge">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {showAnnounceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Post Announcement
            </h2>
            <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>Title</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule Update for DBMS Lab"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>Content</label>
                <textarea
                  rows={4}
                  placeholder="Details of the announcement..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAnnounceModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Invite Student to Group
            </h2>
            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Student Email Address
                </label>
                <input
                  type="email"
                  placeholder="student@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="card-secondary" style={{ fontSize: '12px', color: THEME.deepForestCharcoal }}>
                Or share the direct invite code: <strong>{group.invite_code}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Send Email Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
