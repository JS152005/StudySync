import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { UsersRound, Plus, KeyRound, ArrowRight, Globe, Lock, Shield } from 'lucide-react';

export const Groups: React.FC = () => {
  const toast = useToast();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Group Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupCourse, setGroupCourse] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Join Code Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  const loadGroups = async () => {
    try {
      const data = await apiRequest<{ myGroups: any[]; publicGroups: any[] }>('/groups');
      setMyGroups(data.myGroups);
      setPublicGroups(data.publicGroups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName,
          description: groupDesc,
          subject: groupSubject,
          course: groupCourse,
          is_private: isPrivate,
        }),
      });
      setShowCreateModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupSubject('');
      setGroupCourse('');
      toast.success('Study Group formed!');
      loadGroups();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoiningCode(true);
    try {
      await apiRequest('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      setShowJoinModal(false);
      setInviteCode('');
      toast.success('Joined study group successfully!');
      loadGroups();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoiningCode(false);
    }
  };

  const handleJoinPublic = async (groupId: string) => {
    try {
      await apiRequest('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId }),
      });
      toast.success('Enrolled in study group!');
      loadGroups();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Study Groups
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Join collaborative student circles, share syllabus boards, and hold group focus pacts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            onClick={() => setShowJoinModal(true)}
            leftIcon={<KeyRound size={15} color={THEME.deepForestCharcoal} />}
          >
            Join with Code
          </Button>
          <Button
            variant="primary"
            shape="pill"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus size={15} color={THEME.warmIvory} />}
          >
            Create Group
          </Button>
        </div>
      </div>

      {/* My Groups Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ fontSize: '16.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          My Enrolled Groups ({myGroups.length})
        </h2>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            <Skeleton height="170px" borderRadius={THEME.radius.card} />
            <Skeleton height="170px" borderRadius={THEME.radius.card} />
          </div>
        ) : myGroups.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={36} />}
            title="You haven't joined any study groups yet"
            description="Create a group for your course or enter an invitation code to join peers!"
            action={
              <Button variant="primary" shape="pill" onClick={() => setShowCreateModal(true)}>
                Create Your First Group
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {myGroups.map((g) => (
              <div
                key={g.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  border: `1.5px solid ${THEME.deepForestCharcoal}`,
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.card,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="badge">{g.role}</span>
                    <span style={{ fontSize: '12px', color: THEME.warmStone, fontWeight: 600 }}>
                      {g.member_count} member{g.member_count === 1 ? '' : 's'}
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
                    {g.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', marginBottom: '8px', color: THEME.warmStone }}>
                    {g.subject ? `${g.subject} • ` : ''}{g.course || 'General'}
                  </div>
                  {g.description && (
                    <p style={{ fontSize: '13px', lineHeight: 1.45, color: THEME.deepForestCharcoal }}>
                      {g.description}
                    </p>
                  )}
                </div>

                <NavLink
                  to={`/groups/${g.id}`}
                  className="btn-secondary btn-pill"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Open Group Workspace</span>
                  <ArrowRight size={14} color={THEME.deepForestCharcoal} />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discover Public Groups */}
      {publicGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          <h2 style={{ fontSize: '16.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Explore Public Study Communities
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {publicGroups.map((g) => (
              <div
                key={g.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  backgroundColor: THEME.warmIvory,
                  border: `1.5px solid ${THEME.warmStone}`,
                  borderRadius: THEME.radius.card,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Globe size={14} color={THEME.emeraldGreen} />
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: THEME.emeraldGreen }}>
                      Public Community
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: '15.5px',
                      fontWeight: 800,
                      marginBottom: '4px',
                      color: THEME.deepForestCharcoal,
                    }}
                  >
                    {g.name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: THEME.warmStone }}>
                    {g.subject} • {g.member_count} members
                  </div>
                </div>

                <Button
                  variant="primary"
                  shape="pill"
                  onClick={() => handleJoinPublic(g.id)}
                  style={{ width: '100%' }}
                >
                  Join Group
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessible Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Study Group"
        description="Establish an academic hub for syllabus tracking, focus pacts, and discussion."
      >
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Distributed Systems & Cloud Computing"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
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
              Subject / Topic Focus
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science CSE-402"
              value={groupSubject}
              onChange={(e) => setGroupSubject(e.target.value)}
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
              Course / Branch
            </label>
            <input
              type="text"
              placeholder="e.g. B.Tech 3rd Year"
              value={groupCourse}
              onChange={(e) => setGroupCourse(e.target.value)}
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
              Description & Objectives
            </label>
            <textarea
              rows={2}
              placeholder="Collaborate on weekly assignments, syllabus topics, and exam revision..."
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
            />
          </div>

          {/* Polished Animated ToggleSwitch for Private Group */}
          <div
            style={{
              padding: '12px',
              borderRadius: THEME.radius.md,
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
            }}
          >
            <ToggleSwitch
              id="private-group-toggle"
              checked={isPrivate}
              onChange={setIsPrivate}
              label="Private Group (Invite Code Required)"
              description="When enabled, peers must enter your 6-character invitation code to join."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingGroup}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Join with Code Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Join Study Group with Code"
        description="Enter the unique 6-character code provided by the group creator."
      >
        <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Invitation Code *
            </label>
            <input
              type="text"
              placeholder="e.g. A3F82K"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              style={{
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '0.15em',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={joiningCode}>
              Join Group
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Groups;
