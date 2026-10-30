import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import { UsersRound, Plus, KeyRound, ArrowRight, Lock } from 'lucide-react';

export const Groups: React.FC = () => {
  const toast = useToast();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Group Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSubject, setGroupSubject] = useState('');
  const [groupCourse, setGroupCourse] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Join Code Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  const loadGroups = async () => {
    try {
      const data = await apiRequest<{ myGroups: any[]; publicGroups?: any[] }>('/groups');
      setMyGroups(data.myGroups || []);
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
        }),
      });
      setShowCreateModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupSubject('');
      setGroupCourse('');
      toast.success('Private Study Group created!');
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
        body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
            Study Groups
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', margin: 0 }}>
            Collaborative cohorts for syllabus tracking, shared doubts, and accountability pacts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            shape="pill"
            onClick={() => setShowJoinModal(true)}
            leftIcon={<KeyRound size={15} color="#94A3B8" />}
          >
            Join with Code
          </Button>
          <Button
            variant="primary"
            shape="pill"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus size={15} color="#FFFFFF" />}
          >
            Create Group
          </Button>
        </div>
      </div>

      {/* My Groups Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
          My Enrolled Groups ({myGroups.length})
        </h2>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            <Skeleton height="170px" borderRadius={THEME.radius.card} />
            <Skeleton height="170px" borderRadius={THEME.radius.card} />
          </div>
        ) : myGroups.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={32} />}
            title="You haven't joined any study groups yet"
            description="Create a group for your course or enter an invitation code to join peers!"
            action={
              <Button
                variant="primary"
                shape="pill"
                onClick={(e) => {
                  triggerSparks(e, 'azure', 10);
                  setShowCreateModal(true);
                }}
              >
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
                  gap: '16px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: THEME.radius.card,
                  padding: '22px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className={g.role === 'owner' ? 'badge' : 'badge-outline'}>{g.role}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                      {g.member_count} member{g.member_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      marginBottom: '4px',
                      color: '#F8FAFC',
                    }}
                  >
                    {g.name}
                  </h3>
                  <div style={{ fontSize: '12px', marginBottom: '8px', color: '#64748B' }}>
                    {g.subject ? `${g.subject} • ` : ''}{g.course || 'General'}
                  </div>
                  {g.description && (
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#94A3B8', margin: 0 }}>
                      {g.description}
                    </p>
                  )}
                </div>

                <NavLink
                  to={`/groups/${g.id}`}
                  className="btn-secondary btn-pill"
                  style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
                  onClick={(e) => triggerSparks(e, 'azure', 8)}
                >
                  <span>Open Group Workspace</span>
                  <ArrowRight size={14} color="#94A3B8" />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accessible Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Private Study Group"
        description="Establish an invite-only academic hub for syllabus tracking, focus pacts, and peer rooms."
      >
        <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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

          <div
            style={{
              padding: '12px 14px',
              borderRadius: THEME.radius.md,
              border: '1px solid rgba(14, 165, 233, 0.3)',
              backgroundColor: 'rgba(14, 165, 233, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Lock size={15} color="#38BDF8" />
            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
              All groups on StudySync are private. A unique 6-character code is generated automatically.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creatingGroup}>
              Create Private Group
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
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px',
                color: '#F8FAFC',
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
                fontWeight: 700,
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
