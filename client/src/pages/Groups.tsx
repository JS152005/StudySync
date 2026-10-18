import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { UsersRound, Plus, KeyRound, ArrowRight, Lock, Globe } from 'lucide-react';

export const Groups: React.FC = () => {
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

  // Join Code Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

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
      loadGroups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      setShowJoinModal(false);
      setInviteCode('');
      loadGroups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleJoinPublic = async (groupId: string) => {
    try {
      await apiRequest('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId }),
      });
      loadGroups();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Study Groups</h1>
          <p style={{ fontSize: '13px' }}>Join collaborative student circles, share syllabus boards, and hold group focus pacts.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowJoinModal(true)} className="btn-secondary">
            <KeyRound size={16} color="#E6E6FA" />
            <span>Join with Code</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus size={16} color="#FFFFFF" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* My Groups Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 900 }}>My Enrolled Groups ({myGroups.length})</h2>

        {myGroups.length === 0 ? (
          <div className="card-secondary" style={{ textAlign: 'center', padding: '36px' }}>
            <UsersRound size={36} color="#E6E6FA" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>You haven't joined any study groups yet.</div>
            <div style={{ fontSize: '13px', marginBottom: '14px' }}>
              Create a group for your course or enter an invitation code to join peers!
            </div>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <span>Create Your First Group</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {myGroups.map((g) => (
              <div
                key={g.id}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="badge">{g.role}</span>
                    <span style={{ fontSize: '12px' }}>{g.member_count} member{g.member_count === 1 ? '' : 's'}</span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '4px' }}>{g.name}</h3>
                  <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                    {g.subject ? `${g.subject} • ` : ''}{g.course || 'General'}
                  </div>
                  {g.description && (
                    <p style={{ fontSize: '13px', lineHeight: 1.4 }}>{g.description}</p>
                  )}
                </div>

                <NavLink to={`/groups/${g.id}`} className="btn-secondary" style={{ width: '100%' }}>
                  <span>Open Group Workspace</span>
                  <ArrowRight size={14} color="#E6E6FA" />
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discover Public Groups */}
      {publicGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 900 }}>Explore Public Study Communities</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {publicGroups.map((g) => (
              <div key={g.id} className="card-secondary" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Globe size={14} color="#E6E6FA" />
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800 }}>Public Group</span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '4px' }}>{g.name}</h3>
                  <div style={{ fontSize: '12px' }}>{g.subject} • {g.member_count} members</div>
                </div>

                <button onClick={() => handleJoinPublic(g.id)} className="btn-primary" style={{ width: '100%' }}>
                  <span>Join Group</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Create New Study Group</h2>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Systems & Cloud"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={groupSubject}
                  onChange={(e) => setGroupSubject(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Course / Degree</label>
                <input
                  type="text"
                  placeholder="e.g. B.Tech 6th Sem"
                  value={groupCourse}
                  onChange={(e) => setGroupCourse(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="What will this study group focus on? Exam prep, homework, project work..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="isPrivate" style={{ fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  Private Group (Invite code required to join)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join By Code Modal */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '16px' }}>Join Group with Invite Code</h2>
            <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  Enter 8-Character Invite Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. A1B2C3D4"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowJoinModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Join Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
