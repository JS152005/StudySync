import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { Search, UserPlus, Check, X, Users, UserCheck } from 'lucide-react';

export const Friends: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
    try {
      const res = await apiRequest<{ students: any[] }>(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(res.students);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await apiRequest('/users/friend-requests', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      alert('Friend request sent!');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRespond = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await apiRequest(`/users/friend-requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!window.confirm('Remove this friend connection?')) return;
    try {
      await apiRequest(`/users/friend-requests/${friendshipId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Student Network & Friends</h1>
          <p style={{ fontSize: '13px' }}>Discover classmates, send study connections, and build your peer learning circle.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('friends')}
            style={{
              backgroundColor: activeTab === 'friends' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'friends' ? '#FFFFFF' : '#E6E6FA',
              fontSize: '13px',
              padding: '8px 14px',
            }}
          >
            <Users size={16} color={activeTab === 'friends' ? '#FFFFFF' : '#E6E6FA'} />
            <span>Friends ({friends.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            style={{
              backgroundColor: activeTab === 'requests' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'requests' ? '#FFFFFF' : '#E6E6FA',
              fontSize: '13px',
              padding: '8px 14px',
            }}
          >
            <span>Requests ({incoming.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            style={{
              backgroundColor: activeTab === 'search' ? '#E6E6FA' : '#FFFFFF',
              color: activeTab === 'search' ? '#FFFFFF' : '#E6E6FA',
              fontSize: '13px',
              padding: '8px 14px',
            }}
          >
            <Search size={16} color={activeTab === 'search' ? '#FFFFFF' : '#E6E6FA'} />
            <span>Find Students</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Friends List */}
      {activeTab === 'friends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {friends.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '40px' }}>
              <Users size={32} color="#E6E6FA" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No friends connected yet</div>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>
                Use the Find Students tab to search for peers by name, Student ID, or degree.
              </p>
              <button onClick={() => setActiveTab('search')} className="btn-primary">
                <span>Find Students</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {friends.map((friend) => (
                <div key={friend.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#E6E6FA',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                      }}
                    >
                      {friend.full_name ? friend.full_name[0].toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900 }}>{friend.full_name}</div>
                      <div style={{ fontSize: '12px' }}>@{friend.username} • {friend.course || 'Student'}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFriend(friend.friendship_id)}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                    title="Remove friend connection"
                  >
                    <span>Remove</span>
                  </button>
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
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '12px' }}>
              Incoming Requests ({incoming.length})
            </h2>

            {incoming.length === 0 ? (
              <div style={{ fontSize: '13px' }}>No pending incoming requests.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {incoming.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#F0F8FF',
                      borderRadius: '8px',
                      border: '1px solid #E6E6FA',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900 }}>{req.full_name}</div>
                      <div style={{ fontSize: '12px' }}>@{req.username} • {req.course || 'Student'}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRespond(req.id, 'accept')}
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <Check size={14} color="#FFFFFF" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'decline')}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <X size={14} color="#E6E6FA" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="card-secondary">
            <h2 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '12px' }}>
              Sent Pending Requests ({outgoing.length})
            </h2>

            {outgoing.length === 0 ? (
              <div style={{ fontSize: '13px' }}>No outgoing requests waiting for response.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E6E6FA',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800 }}>{req.full_name}</div>
                      <div style={{ fontSize: '12px' }}>@{req.username}</div>
                    </div>
                    <span className="badge-outline">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Search Students */}
      {activeTab === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search by student name, username, Student ID, or degree..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
              <Search size={16} color="#FFFFFF" />
              <span>Search</span>
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {searchResults.map((student) => (
                <div
                  key={student.id}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#E6E6FA',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                      }}
                    >
                      {student.full_name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900 }}>{student.full_name}</div>
                      <div style={{ fontSize: '11px' }}>@{student.username}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px' }}>
                    {student.course} {student.college ? `• ${student.college}` : ''}
                  </div>

                  <button
                    onClick={() => handleSendRequest(student.id)}
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: 'auto', padding: '8px' }}
                  >
                    <UserPlus size={14} color="#E6E6FA" />
                    <span>Connect</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
