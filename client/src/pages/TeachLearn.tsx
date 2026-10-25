import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { GraduationCap, BookOpen, Check, X, Plus, Trash2, Video, Send, Users, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const TeachLearn: React.FC = () => {
  const toast = useToast();
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
  const [savingTopic, setSavingTopic] = useState(false);

  // Send Request Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

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
    setSavingTopic(true);
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
      toast.success(modalType === 'teach' ? 'Added to your teaching topics!' : 'Added to your learning goals!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingTopic(false);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    try {
      await apiRequest(`/teach/topics/${id}`, { method: 'DELETE' });
      toast.info('Topic removed');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeer) return;
    setSendingRequest(true);
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
      toast.success('Study request sent to peer!');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespondRequest = async (id: string, action: 'accept' | 'decline') => {
    try {
      await apiRequest(`/teach/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      toast.success(`Request ${action === 'accept' ? 'accepted' : 'declined'}`);
      loadData();
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
            Teach Me / I'll Teach You
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Peer matching engine connecting students who understand a concept with students who need guidance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            shape="pill"
            onClick={() => {
              setModalType('teach');
              setShowAddModal(true);
            }}
            leftIcon={<Plus size={15} color={THEME.warmIvory} />}
          >
            Add "I Can Teach"
          </Button>
          <Button
            variant="secondary"
            shape="pill"
            onClick={() => {
              setModalType('learn');
              setShowAddModal(true);
            }}
            leftIcon={<Plus size={15} color={THEME.deepForestCharcoal} />}
          >
            Add "I Need Help"
          </Button>
        </div>
      </div>

      {/* Peer Study Requests Alerts */}
      {incomingRequests.length > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: THEME.warmIvory,
            border: `2px solid ${THEME.vermilion}`,
            borderRadius: THEME.radius.card,
            boxShadow: THEME.shadow.lifted,
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
                padding: '12px 16px',
                backgroundColor: THEME.warmIvory,
                borderRadius: THEME.radius.md,
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  {req.sender_name} wants to study: {req.subject} — {req.topic}
                </div>
                {req.message && (
                  <div style={{ fontSize: '12px', color: THEME.warmStone, fontStyle: 'italic', marginTop: '2px' }}>
                    "{req.message}"
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  shape="pill"
                  onClick={() => handleRespondRequest(req.id, 'accept')}
                  leftIcon={<Check size={14} color={THEME.warmIvory} />}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={() => handleRespondRequest(req.id, 'decline')}
                  leftIcon={<X size={14} color={THEME.deepForestCharcoal} />}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Matched Peers Section */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          <Skeleton height="280px" borderRadius={THEME.radius.card} />
          <Skeleton height="280px" borderRadius={THEME.radius.card} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Peers who can teach you */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={20} color={THEME.emeraldGreen} />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Peers Who Can Teach You
              </h2>
            </div>

            {peerTeachers.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={28} />}
                title="No peer tutor matches yet"
                description="Add more concepts to your 'I Need Help' list to match with qualified peers."
              />
            ) : (
              peerTeachers.map((peer, idx) => (
                <div
                  key={idx}
                  className="card card-interactive"
                  style={{
                    padding: '14px',
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.md,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <span className="badge">Can Teach You</span>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, marginTop: '4px', color: THEME.deepForestCharcoal }}>
                        {peer.subject}: {peer.topic}
                      </div>
                      <div style={{ fontSize: '12px', color: THEME.warmStone }}>
                        Tutor: {peer.full_name} (@{peer.username}) • {peer.course || 'Student'}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      shape="pill"
                      onClick={() => {
                        setSelectedPeer(peer);
                        setShowRequestModal(true);
                      }}
                      leftIcon={<Send size={13} color={THEME.warmIvory} />}
                    >
                      Request
                    </Button>
                  </div>
                  {peer.peer_notes && (
                    <div style={{ fontSize: '12px', color: THEME.warmStone, fontStyle: 'italic' }}>
                      Note: "{peer.peer_notes}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Peers who need your help */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color={THEME.emeraldGreen} />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Peers Seeking Your Help
              </h2>
            </div>

            {peerLearners.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={28} />}
                title="No students requesting help yet"
                description="List your strong subjects in 'I Can Teach' to help classmates succeed."
              />
            ) : (
              peerLearners.map((peer, idx) => (
                <div
                  key={idx}
                  className="card card-interactive"
                  style={{
                    padding: '14px',
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.md,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <span className="badge-outline">Needs Help</span>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, marginTop: '4px', color: THEME.deepForestCharcoal }}>
                        {peer.subject}: {peer.topic}
                      </div>
                      <div style={{ fontSize: '12px', color: THEME.warmStone }}>
                        Learner: {peer.full_name} (@{peer.username}) • {peer.course || 'Student'}
                      </div>
                    </div>

                    <NavLink to="/rooms" className="btn-secondary btn-sm btn-pill" style={{ display: 'inline-flex' }}>
                      <Video size={13} color={THEME.deepForestCharcoal} />
                      <span>Invite</span>
                    </NavLink>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* My Topic Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* I Can Teach List */}
        <div
          className="card"
          style={{
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            borderRadius: THEME.radius.card,
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px', color: THEME.deepForestCharcoal }}>
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
                  padding: '10px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.warmStone}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                    {t.subject} — {t.topic}
                  </div>
                  {t.notes && <div style={{ fontSize: '11.5px', color: THEME.warmStone }}>{t.notes}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTopic(t.id)}
                  aria-label="Remove topic"
                >
                  <Trash2 size={13} color={THEME.warmStone} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* I Need Help List */}
        <div
          className="card"
          style={{
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            borderRadius: THEME.radius.card,
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px', color: THEME.deepForestCharcoal }}>
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
                  padding: '10px 14px',
                  backgroundColor: THEME.warmIvory,
                  borderRadius: THEME.radius.md,
                  border: `1px solid ${THEME.warmStone}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                    {t.subject} — {t.topic}
                  </div>
                  {t.notes && <div style={{ fontSize: '11.5px', color: THEME.warmStone }}>{t.notes}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTopic(t.id)}
                  aria-label="Remove topic"
                >
                  <Trash2 size={13} color={THEME.warmStone} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessible Add Topic Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={modalType === 'teach' ? 'Add Topic You Can Teach' : 'Add Topic You Need Help With'}
        description={
          modalType === 'teach'
            ? 'Highlight your academic strengths to help your peers.'
            : 'Specify difficult concepts so compatible peer mentors can find you.'
        }
      >
        <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Subject *
            </label>
            <input
              type="text"
              placeholder="e.g. Data Structures & Algorithms"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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
              Topic / Concept *
            </label>
            <input
              type="text"
              placeholder="e.g. Red-Black Trees & AVL Rotation"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
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
              Details / Study Notes
            </label>
            <textarea
              rows={2}
              placeholder="Specific questions, textbook chapters, or reference material..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingTopic}>
              Add Topic
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Send Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setSelectedPeer(null);
        }}
        title="Send Study Session Request"
        description={selectedPeer ? `Connect with ${selectedPeer.full_name} for ${selectedPeer.subject} (${selectedPeer.topic})` : ''}
      >
        <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              Personal Invitation Message
            </label>
            <textarea
              rows={3}
              placeholder="Hi! I saw you understand this topic. Would you be open for a 20-minute study room to review the core formulas?"
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowRequestModal(false);
                setSelectedPeer(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={sendingRequest}>
              Send Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeachLearn;
