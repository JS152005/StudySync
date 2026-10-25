import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DoubtQueue } from '../components/DoubtQueue';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import {
  Video,
  ListTodo,
  Timer,
  FolderOpen,
  Mail,
  LogOut,
  Megaphone,
  Plus,
  Users,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export const GroupDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'doubts' | 'members'>('overview');

  // Announcement Modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [postingAnn, setPostingAnn] = useState(false);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Leave Group Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadGroup = async () => {
    try {
      const data = await apiRequest(`/groups/${id}`);
      setGroupData(data);
    } catch (err: any) {
      toast.error(err.message);
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
    setPostingAnn(true);
    try {
      await apiRequest(`/groups/${id}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ title: annTitle, content: annContent }),
      });
      setShowAnnounceModal(false);
      setAnnTitle('');
      setAnnContent('');
      toast.success('Announcement broadcast to group!');
      loadGroup();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPostingAnn(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);
    try {
      await apiRequest(`/groups/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      toast.success(`Invitation dispatched to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await apiRequest(`/groups/${id}/leave`, { method: 'POST' });
      toast.info('Left study group workspace');
      navigate('/groups');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLeaving(false);
      setShowLeaveModal(false);
    }
  };

  if (loading || !groupData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Skeleton height="140px" borderRadius={THEME.radius.card} />
        <Skeleton height="50px" borderRadius={THEME.radius.pill} />
        <Skeleton height="300px" borderRadius={THEME.radius.card} />
      </div>
    );
  }

  const { group, membership, members, announcements, activeRooms } = groupData;
  const isOwnerOrMod = membership?.role === 'owner' || membership?.role === 'moderator';

  const tabOptions: SegmentOption<'overview' | 'doubts' | 'members'>[] = [
    { value: 'overview', label: 'Overview & Bulletin', icon: <Megaphone size={14} /> },
    { value: 'doubts', label: 'Group Doubts', icon: <Sparkles size={14} /> },
    { value: 'members', label: `Members (${members.length})`, icon: <Users size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Group Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
          backgroundColor: THEME.warmIvory,
          border: `2px solid ${THEME.emeraldGreen}`,
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge">{membership?.role || 'Member'}</span>
              <span className="badge-outline">Invite Code: {group.invite_code}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              {group.name}
            </h1>
            <p style={{ fontSize: '13px', color: THEME.warmStone, marginTop: '2px' }}>
              {group.subject ? `${group.subject} • ` : ''}
              {group.course || 'Study Group'} • {members.length} member{members.length === 1 ? '' : 's'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => setShowInviteModal(true)}
              leftIcon={<Mail size={14} color={THEME.deepForestCharcoal} />}
            >
              Invite Member
            </Button>
            <NavLink to={`/rooms?group_id=${group.id}`} className="btn-primary btn-sm btn-pill" style={{ display: 'inline-flex' }}>
              <Video size={14} color={THEME.warmIvory} />
              <span>Launch Room</span>
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => setShowLeaveModal(true)}
              aria-label="Leave group"
              title="Leave Group"
            >
              <LogOut size={15} color={THEME.warmStone} />
            </Button>
          </div>
        </div>

        {group.description && (
          <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: THEME.deepForestCharcoal }}>
            {group.description}
          </p>
        )}

        {/* Quick Collaboration Tool Links */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            paddingTop: '12px',
            borderTop: `1px solid ${THEME.warmStone}`,
          }}
        >
          <NavLink to={`/syllabus?group_id=${group.id}`} className="btn-secondary btn-sm btn-pill" style={{ display: 'inline-flex' }}>
            <ListTodo size={14} color={THEME.deepForestCharcoal} />
            <span>Syllabus Board</span>
          </NavLink>
          <NavLink to={`/focus?group_id=${group.id}`} className="btn-secondary btn-sm btn-pill" style={{ display: 'inline-flex' }}>
            <Timer size={14} color={THEME.deepForestCharcoal} />
            <span>Group Focus Pact</span>
          </NavLink>
          <NavLink to={`/resources?group_id=${group.id}`} className="btn-secondary btn-sm btn-pill" style={{ display: 'inline-flex' }}>
            <FolderOpen size={14} color={THEME.deepForestCharcoal} />
            <span>Shared Resources</span>
          </NavLink>
        </div>
      </div>

      {/* Segmented View Tabs */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          variant="pill"
          size="md"
        />
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Study Rooms */}
          {activeRooms.length > 0 && (
            <div
              className="card"
              style={{
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
                borderRadius: THEME.radius.card,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span className="live-pulse-dot" />
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  Live Study Rooms Running Now
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeRooms.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: THEME.warmIvory,
                      borderRadius: THEME.radius.md,
                      border: `1px solid ${THEME.deepForestCharcoal}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '12px', color: THEME.warmStone }}>
                        Host: {r.host_name} • {r.subject}
                      </div>
                    </div>
                    <NavLink to={`/rooms/${r.id}`} className="btn-primary btn-sm btn-pill">
                      <span>Join Room</span>
                    </NavLink>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Announcements */}
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
              borderRadius: THEME.radius.card,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} color={THEME.emeraldGreen} />
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  Group Announcements & Bulletin
                </h2>
              </div>
              {isOwnerOrMod && (
                <Button
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={() => setShowAnnounceModal(true)}
                  leftIcon={<Plus size={14} color={THEME.deepForestCharcoal} />}
                >
                  Post Announcement
                </Button>
              )}
            </div>

            {announcements.length === 0 ? (
              <EmptyState
                icon={<Megaphone size={28} />}
                title="No announcements yet"
                description="Keep members aligned on upcoming assignment dates, notes, and study rooms."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {announcements.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '14px 18px',
                      backgroundColor: THEME.warmIvory,
                      borderRadius: THEME.radius.md,
                      border: `1px solid ${THEME.deepForestCharcoal}`,
                      boxShadow: THEME.shadow.subtle,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                        {a.title}
                      </span>
                      <span style={{ fontSize: '11px', color: THEME.warmStone }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: THEME.deepForestCharcoal }}>
                      {a.content}
                    </p>
                    <div style={{ fontSize: '11px', marginTop: '6px', color: THEME.warmStone, fontStyle: 'italic' }}>
                      Posted by {a.author_name}
                    </div>
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
        <div
          className="card"
          style={{
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            borderRadius: THEME.radius.card,
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', color: THEME.deepForestCharcoal }}>
            Group Directory ({members.length} Enrolled Students)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {members.map((m: any) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.deepForestCharcoal}`,
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: THEME.radius.full,
                    backgroundColor: THEME.emeraldGreen,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: THEME.warmIvory,
                    fontWeight: 800,
                    fontSize: '13px',
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    flexShrink: 0,
                  }}
                >
                  {m.full_name ? m.full_name[0].toUpperCase() : 'M'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: THEME.deepForestCharcoal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.full_name}
                    </span>
                    <span className="badge-outline" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                      {m.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: THEME.warmStone }}>@{m.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessible Post Announcement Modal */}
      <Modal
        isOpen={showAnnounceModal}
        onClose={() => setShowAnnounceModal(false)}
        title="Post Group Announcement"
        description="Share key notifications with all group members."
      >
        <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Headline / Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Unit 3 Test Review Session Tomorrow at 6 PM"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
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
              Announcement Content *
            </label>
            <textarea
              rows={4}
              placeholder="Provide meeting link, assigned study problems, or preparation agenda..."
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowAnnounceModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={postingAnn}>
              Publish Announcement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Student to Group"
        description="Send an email invitation containing your group's private joining code."
      >
        <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Student Email Address *
            </label>
            <input
              type="email"
              placeholder="classmate@college.edu"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={sendingInvite}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Leave Group Confirmation Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Study Group?"
        description="Are you sure you want to disconnect from this group's workspace?"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>
            Stay in Group
          </Button>
          <Button variant="vermilion" onClick={handleLeave} loading={leaving}>
            Leave Group
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default GroupDetails;
