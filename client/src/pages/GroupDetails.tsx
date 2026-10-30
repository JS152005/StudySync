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
import { triggerSparks } from '../components/ui/SparkEffect';
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
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

export const GroupDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'doubts' | 'members'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);

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

  const handleCopyInviteCode = (e: React.MouseEvent) => {
    if (!groupData?.group?.invite_code) return;
    navigator.clipboard.writeText(groupData.group.invite_code);
    setCopiedCode(true);
    triggerSparks(e, 'azure', 8);
    toast.success('Group invite code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2200);
  };

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
        <Skeleton height="160px" borderRadius={THEME.radius.cardLg} />
        <Skeleton height="44px" borderRadius={THEME.radius.pill} />
        <Skeleton height="320px" borderRadius={THEME.radius.card} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Group Header Card */}
      <div
        className="card-featured"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '3px solid #0284C7',
          borderRadius: THEME.radius.cardLg,
          padding: '24px 28px',
        }}
      >
        {/* Top Meta Line: Badges & Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="badge">
                {membership?.role || 'Member'}
              </span>

              {/* Interactive Copyable Invite Code Chip */}
              <button
                type="button"
                onClick={handleCopyInviteCode}
                title="Click to copy invite code"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  backgroundColor: copiedCode ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${copiedCode ? '#0EA5E9' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: THEME.radius.pill,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: copiedCode ? '#38BDF8' : '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                }}
              >
                {copiedCode ? (
                  <>
                    <Check size={12} color="#38BDF8" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} color="#94A3B8" />
                    <span>Code: <strong style={{ color: '#F8FAFC' }}>{group.invite_code}</strong></span>
                  </>
                )}
              </button>

              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                • {members.length} {members.length === 1 ? 'student' : 'students'} enrolled
              </span>
            </div>

            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                margin: 0,
              }}
            >
              {group.name}
            </h1>

            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
              {group.subject ? `${group.subject} • ` : ''}
              {group.course || 'Study Group'}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => setShowInviteModal(true)}
              leftIcon={<Mail size={14} color="#94A3B8" />}
            >
              Invite Member
            </Button>

            <NavLink
              to={`/rooms?group_id=${group.id}`}
              className="btn-primary btn-sm btn-pill"
              style={{ display: 'inline-flex', gap: '6px' }}
              onClick={(e) => triggerSparks(e, 'azure', 10)}
            >
              <Video size={14} color="#FFFFFF" />
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
              <LogOut size={15} color="#94A3B8" />
            </Button>
          </div>
        </div>

        {group.description && (
          <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#94A3B8', margin: 0 }}>
            {group.description}
          </p>
        )}

        {/* Quick Collaboration Tools Navigation Strip */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <NavLink
            to={`/syllabus?group_id=${group.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.pill,
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#0F172A',
              textDecoration: 'none',
              transition: 'all 160ms ease',
            }}
            className="group-subtool-pill"
          >
            <ListTodo size={14} color="#0284C7" />
            <span>Syllabus Board</span>
          </NavLink>

          <NavLink
            to={`/focus?group_id=${group.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.pill,
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#0F172A',
              textDecoration: 'none',
              transition: 'all 160ms ease',
            }}
            className="group-subtool-pill"
          >
            <Timer size={14} color="#0284C7" />
            <span>Group Focus Pact</span>
          </NavLink>

          <NavLink
            to={`/resources?group_id=${group.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: THEME.radius.pill,
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#0F172A',
              textDecoration: 'none',
              transition: 'all 160ms ease',
            }}
            className="group-subtool-pill"
          >
            <FolderOpen size={14} color="#0284C7" />
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

      {/* Tab 1: Overview & Bulletin */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Study Rooms */}
          {activeRooms.length > 0 && (
            <div
              className="card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: THEME.radius.card,
                padding: '20px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span className="live-pulse-dot" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Live Study Rooms Running Now
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeRooms.map((r: any) => (
                  <div
                    key={r.id}
                    className="item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderRadius: THEME.radius.md,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        Host: {r.host_name} • {r.subject || 'Collaborative Study'}
                      </div>
                    </div>
                    <NavLink
                      to={`/rooms/${r.id}`}
                      className="btn-primary btn-sm btn-pill"
                      onClick={(e) => triggerSparks(e, 'azure', 8)}
                    >
                      <span>Join Room</span>
                    </NavLink>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Announcements Bulletin */}
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: THEME.radius.card,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Megaphone size={16} color="#0284C7" />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Group Announcements & Bulletin
                </h2>
              </div>

              {isOwnerOrMod && (
                <Button
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={() => setShowAnnounceModal(true)}
                  leftIcon={<Plus size={14} color="#0F172A" />}
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
                    className="item-row"
                    style={{
                      padding: '16px 20px',
                      borderRadius: THEME.radius.md,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#0F172A' }}>
                        {a.title}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#475569', margin: 0 }}>
                      {a.content}
                    </p>
                    <div style={{ fontSize: '11px', marginTop: '8px', color: '#64748B' }}>
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
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: THEME.radius.card,
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users size={18} color="#0284C7" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Group Directory ({members.length} Enrolled Students)
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {members.map((m: any) => (
              <div
                key={m.id}
                className="item-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: THEME.radius.md,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284C7',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  {m.full_name ? m.full_name[0].toUpperCase() : 'M'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.full_name}
                    </span>
                    <span className="badge-outline" style={{ fontSize: '10px', textTransform: 'capitalize', padding: '1px 7px' }}>
                      {m.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>@{m.username}</div>
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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

      <style>{`
        .group-subtool-pill:hover {
          background-color: #1A243A !important;
          border-color: #0EA5E9 !important;
          color: #38BDF8 !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export default GroupDetails;
