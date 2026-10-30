import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { Search, UserPlus, Check, X, Users, UserCheck, Copy } from 'lucide-react';

export const Friends: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        apiRequest<{ friends: any[] }>('/users/friends'),
        apiRequest<{ incoming: any[]; outgoing: any[] }>('/users/friend-requests'),
      ]);
      setFriends(friendsRes.friends);
      setIncoming(requestsRes.incoming);
      setOutgoing(requestsRes.outgoing);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await apiRequest<{ students: any[] }>(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(res.students);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await apiRequest('/users/friend-requests', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      toast.success('Friend connection sent!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRespond = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await apiRequest(`/users/friend-requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      toast.success(`Request ${action === 'accept' ? 'accepted' : 'declined'}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!window.confirm('Remove this friend connection?')) return;
    try {
      await apiRequest(`/users/friend-requests/${friendshipId}`, { method: 'DELETE' });
      toast.info('Connection removed');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const tabOptions: SegmentOption<'friends' | 'requests' | 'search'>[] = [
    { value: 'friends', label: 'Friends', count: friends.length, icon: <Users size={14} /> },
    { value: 'requests', label: 'Requests', count: incoming.length, icon: <UserCheck size={14} /> },
    { value: 'search', label: 'Find Students', icon: <Search size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Student Network & Peer Circle
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Discover classmates, send study connections, and build your peer learning circle.
          </p>
        </div>

        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          variant="pill"
          size="md"
        />
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          <Skeleton height="70px" borderRadius={THEME.radius.card} />
          <Skeleton height="70px" borderRadius={THEME.radius.card} />
          <Skeleton height="70px" borderRadius={THEME.radius.card} />
        </div>
      ) : (
        <>
          {/* Tab 1: Friends List */}
          {activeTab === 'friends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {friends.length === 0 ? (
                <EmptyState
                  icon={<Users size={32} />}
                  title="No friends connected yet"
                  description="Use the Find Students tab to search for peers by name, Student ID, or degree course."
                  action={
                    <Button variant="primary" shape="pill" onClick={() => setActiveTab('search')}>
                      Find Classmates
                    </Button>
                  }
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="card card-interactive"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px',
                        border: '1px solid #E2E8F0',
                        borderRadius: THEME.radius.card,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: THEME.radius.full,
                            backgroundColor: 'rgba(2, 132, 199, 0.1)',
                            color: '#0284C7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '14px',
                            border: '1px solid rgba(2, 132, 199, 0.3)',
                            flexShrink: 0,
                          }}
                        >
                          {friend.full_name ? friend.full_name[0].toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                            {friend.full_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            @{friend.username} • {friend.course || 'Student'}
                          </div>
                          {friend.student_id && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: '#0284C7',
                                  backgroundColor: '#F1F5F9',
                                  border: '1px solid #E2E8F0',
                                  padding: '1px 6px',
                                  borderRadius: THEME.radius.sharp,
                                }}
                              >
                                {friend.student_id}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(friend.student_id);
                                  toast.success(`Copied ${friend.student_id}`);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                title="Copy Student ID"
                              >
                                <Copy size={11} color="#94A3B8" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        shape="pill"
                        onClick={() => handleRemoveFriend(friend.friendship_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Friend Requests */}
          {activeTab === 'requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Incoming */}
              <div
                className="card"
                style={{
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  borderRadius: THEME.radius.card,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <UserCheck size={18} color="#0284C7" />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Incoming Requests ({incoming.length})
                  </h2>
                </div>

                {incoming.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>
                    No pending incoming requests.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {incoming.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: THEME.radius.md,
                          border: '1px solid #E2E8F0',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
                            {req.full_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            @{req.username} • {req.course || 'Student'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            shape="pill"
                            onClick={() => handleRespond(req.id, 'accept')}
                            leftIcon={<Check size={13} color="#FFFFFF" />}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            shape="pill"
                            onClick={() => handleRespond(req.id, 'decline')}
                            leftIcon={<X size={13} color="#0F172A" />}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing */}
              {outgoing.length > 0 && (
                <div
                  className="card-secondary"
                  style={{
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    borderRadius: THEME.radius.card,
                  }}
                >
                  <h2 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px', color: '#0F172A' }}>
                    Pending Sent Invitations ({outgoing.length})
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {outgoing.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: THEME.radius.md,
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A' }}>
                            {req.full_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>@{req.username}</div>
                        </div>
                        <span className="badge-stone">Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Search Students */}
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Search by Student ID (e.g. STU-...), name, username, course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  shape="pill"
                  loading={searching}
                  leftIcon={<Search size={15} color="#FFFFFF" />}
                >
                  Search
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {searchResults.map((st) => (
                    <div
                      key={st.id}
                      className="card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px',
                        border: '1px solid #E2E8F0',
                        borderRadius: THEME.radius.card,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {st.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          @{st.username} • {st.course || 'Student'}
                        </div>
                        {st.student_id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                color: '#0284C7',
                                backgroundColor: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                padding: '1px 6px',
                                borderRadius: THEME.radius.sharp,
                              }}
                            >
                              {st.student_id}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(st.student_id);
                                toast.success(`Copied ${st.student_id}`);
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title="Copy Student ID"
                            >
                              <Copy size={11} color="#94A3B8" />
                            </button>
                          </div>
                        )}
                        {st.college && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{st.college}</div>}
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        shape="pill"
                        onClick={() => handleSendRequest(st.id)}
                        leftIcon={<UserPlus size={13} color="#FFFFFF" />}
                      >
                        Connect
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Friends;
