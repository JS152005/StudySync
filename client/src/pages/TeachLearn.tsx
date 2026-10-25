import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { GraduationCap, BookOpen, Check, X, Plus, Trash2, Video } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const TeachLearn: React.FC = () => {
  const [teachTopics, setTeachTopics] = useState<any[]>([]);
  const [learnTopics, setLearnTopics] = useState<any[]>([]);
  const [peerTeachers, setPeerTeachers] = useState<any[]>([]);
  const [peerLearners, setPeerLearners] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Topic Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'teach' | 'learn'>('teach');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');

  // Send Request Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [requestMsg, setRequestMsg] = useState('');

  const loadData = async () => {
    try {
      const [topicsRes, matchesRes, requestsRes] = await Promise.all([
        apiRequest<{ teachTopics: any[]; learnTopics: any[] }>('/teach/topics'),
        apiRequest<{ peerTeachers: any[]; peerLearners: any[] }>('/teach/matches'),
        apiRequest<{ incoming: any[]; outgoing: any[] }>('/teach/requests'),
      ]);
      setTeachTopics(topicsRes.teachTopics);
      setLearnTopics(topicsRes.learnTopics);
      setPeerTeachers(matchesRes.peerTeachers);
      setPeerLearners(matchesRes.peerLearners);
      setIncomingRequests(requestsRes.incoming);
      setOutgoingRequests(requestsRes.outgoing);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/teach/topics', {
        method: 'POST',
        body: JSON.stringify({
          type: modalType,
          subject,
          topic,
          notes,
        }),
      });
      setShowAddModal(false);
      setSubject('');
      setTopic('');
      setNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    try {
      await apiRequest(`/teach/topics/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeer) return;
    try {
      await apiRequest('/teach/requests', {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: selectedPeer.user_id,
          subject: selectedPeer.subject,
          topic: selectedPeer.topic,
          message: requestMsg,
        }),
      });
      setShowRequestModal(false);
      setSelectedPeer(null);
      setRequestMsg('');
      alert('Study request sent to peer!');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRespondRequest = async (id: string, action: 'accept' | 'decline') => {
    try {
      await apiRequest(`/teach/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Teach Me / I'll Teach You
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Peer matching engine connecting students who understand a concept with students who need guidance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setModalType('teach');
              setShowAddModal(true);
            }}
            className="btn-primary"
          >
            <Plus size={15} color={THEME.warmIvory} />
            <span>Add "I Can Teach"</span>
          </button>
          <button
            onClick={() => {
              setModalType('learn');
              setShowAddModal(true);
            }}
            className="btn-secondary"
          >
            <Plus size={15} color={THEME.deepForestCharcoal} />
            <span>Add "I Need Help"</span>
          </button>
        </div>
      </div>

      {/* Peer Study Requests Alerts */}
      {incomingRequests.length > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: THEME.warmIvory,
            border: `2px solid ${THEME.vermilion}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-urgent">Incoming Requests</span>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              Peer Study Requests ({incomingRequests.length})
            </h2>
          </div>
          {incomingRequests.map((req) => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: THEME.warmIvory,
                borderRadius: '6px',
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  {req.sender_name} wants to study: {req.subject} — {req.topic}
                </div>
                {req.message && (
                  <div style={{ fontSize: '12px', color: THEME.warmStone, fontStyle: 'italic', marginTop: '2px' }}>
                    "{req.message}"
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleRespondRequest(req.id, 'accept')}
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Check size={14} color={THEME.warmIvory} />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => handleRespondRequest(req.id, 'decline')}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <X size={14} color={THEME.deepForestCharcoal} />
                  <span>Decline</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Matched Peers Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Peers who can teach you */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GraduationCap size={20} color={THEME.emeraldGreen} />
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              Peers Who Can Teach You
            </h2>
          </div>

          {peerTeachers.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '13px', color: THEME.warmStone }}>
                No peer tutor matches found yet. Add more topics you need help with!
              </div>
            </div>
          ) : (
            peerTeachers.map((peer, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${THEME.deepForestCharcoal}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge">Can Teach You</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '4px', color: THEME.deepForestCharcoal }}>
                      {peer.subject}: {peer.topic}
                    </div>
                    <div style={{ fontSize: '12px', color: THEME.warmStone }}>
                      Tutor: {peer.full_name} (@{peer.username}) • {peer.course || 'Student'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPeer(peer);
                      setShowRequestModal(true);
                    }}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '11.5px' }}
                  >
                    <span>Request Session</span>
                  </button>
                </div>
                {peer.peer_notes && (
                  <div style={{ fontSize: '11px', color: THEME.warmStone, fontStyle: 'italic' }}>Note: "{peer.peer_notes}"</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Peers who need your help */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color={THEME.emeraldGreen} />
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
              Peers Seeking Your Help
            </h2>
          </div>

          {peerLearners.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '13px', color: THEME.warmStone }}>
                No students currently requesting topics you teach. Add your strong subjects!
              </div>
            </div>
          ) : (
            peerLearners.map((peer, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${THEME.deepForestCharcoal}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge-outline">Needs Help</span>
                    <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '4px', color: THEME.deepForestCharcoal }}>
                      {peer.subject}: {peer.topic}
                    </div>
                    <div style={{ fontSize: '12px', color: THEME.warmStone }}>
                      Learner: {peer.full_name} (@{peer.username}) • {peer.course || 'Student'}
                    </div>
                  </div>

                  <NavLink to="/rooms" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11.5px' }}>
                    <Video size={13} color={THEME.deepForestCharcoal} />
                    <span>Invite to Room</span>
                  </NavLink>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* My Topic Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* I Can Teach List */}
        <div className="card" style={{ border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '10px', color: THEME.deepForestCharcoal }}>
            My "I Can Teach" Topics ({teachTopics.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teachTopics.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${THEME.warmStone}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{t.subject} — {t.topic}</div>
                  {t.notes && <div style={{ fontSize: '11px', color: THEME.warmStone }}>{t.notes}</div>}
                </div>
                <button onClick={() => handleDeleteTopic(t.id)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                  <Trash2 size={12} color={THEME.deepForestCharcoal} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* I Need Help List */}
        <div className="card" style={{ border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '10px', color: THEME.deepForestCharcoal }}>
            My "I Need Help" Topics ({learnTopics.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {learnTopics.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: '6px',
                  border: `1px solid ${THEME.warmStone}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{t.subject} — {t.topic}</div>
                  {t.notes && <div style={{ fontSize: '11px', color: THEME.warmStone }}>{t.notes}</div>}
                </div>
                <button onClick={() => handleDeleteTopic(t.id)} className="btn-secondary" style={{ padding: '4px 8px' }}>
                  <Trash2 size={12} color={THEME.deepForestCharcoal} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Topic Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Add {modalType === 'teach' ? '"I Can Teach"' : '"I Need Help"'} Topic
            </h2>
            <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Topic Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Virtual Memory & Page Replacement"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Notes / Context
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Can walk through FIFO vs LRU examples..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Study Request Modal */}
      {showRequestModal && selectedPeer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Request Peer Study Session
            </h2>
            <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="card-secondary" style={{ fontSize: '13px', color: THEME.deepForestCharcoal }}>
                Connecting with <strong>{selectedPeer.full_name}</strong> for:
                <br />
                <strong>{selectedPeer.subject} — {selectedPeer.topic}</strong>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Optional Note / Preferred Study Time
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Hi! Are you free for a 30-min call on Wednesday afternoon to review this topic?"
                  value={requestMsg}
                  onChange={(e) => setRequestMsg(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Send Study Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
