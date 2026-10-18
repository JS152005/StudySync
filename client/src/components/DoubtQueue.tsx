import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { ThumbsUp, CheckCircle, Clock, HelpCircle, Trash2, Plus } from 'lucide-react';

interface Doubt {
  id: string;
  room_id?: string;
  group_id?: string;
  author_id: string;
  author_name: string;
  author_username: string;
  question: string;
  topic?: string;
  status: 'waiting' | 'answering' | 'solved';
  votes_count: number;
  user_voted: number;
  created_at: string;
}

interface DoubtQueueProps {
  roomId?: string;
  groupId?: string;
  isHost?: boolean;
}

export const DoubtQueue: React.FC<DoubtQueueProps> = ({ roomId, groupId, isHost }) => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [topicText, setTopicText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'answering' | 'solved'>('all');

  const loadDoubts = async () => {
    try {
      const query = roomId ? `?room_id=${roomId}` : `?group_id=${groupId}`;
      const data = await apiRequest<{ doubts: Doubt[] }>(`/doubts${query}`);
      setDoubts(data.doubts);
    } catch (err) {
      console.error('Failed to load doubts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoubts();
    const interval = setInterval(loadDoubts, 5000);
    return () => clearInterval(interval);
  }, [roomId, groupId]);

  const handleVote = async (doubtId: string) => {
    try {
      const res = await apiRequest<{ votes_count: number; user_voted: number }>(`/doubts/${doubtId}/vote`, {
        method: 'POST',
      });
      setDoubts((prev) =>
        prev.map((d) => (d.id === doubtId ? { ...d, votes_count: res.votes_count, user_voted: res.user_voted } : d))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (doubtId: string, newStatus: string) => {
    try {
      await apiRequest(`/doubts/${doubtId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadDoubts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (doubtId: string) => {
    if (!window.confirm('Delete this doubt?')) return;
    try {
      await apiRequest(`/doubts/${doubtId}`, { method: 'DELETE' });
      setDoubts((prev) => prev.filter((d) => d.id !== doubtId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiRequest<{ doubt: Doubt }>('/doubts', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          group_id: groupId,
          question: questionText.trim(),
          topic: topicText.trim(),
        }),
      });
      setDoubts((prev) => [res.doubt, ...prev]);
      setQuestionText('');
      setTopicText('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDoubts = doubts.filter((d) => (filter === 'all' ? true : d.status === filter));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Submit Doubt Form */}
      <form
        onSubmit={handleSubmit}
        className="card-secondary"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={18} color="#E6E6FA" />
          <span style={{ fontSize: '15px', fontWeight: 900, color: '#E6E6FA' }}>
            Ask a Question (Doubt Queue)
          </span>
        </div>

        <input
          type="text"
          placeholder="Topic / Concept (e.g. Dijkstra algorithm edge cases)"
          value={topicText}
          onChange={(e) => setTopicText(e.target.value)}
        />

        <textarea
          rows={2}
          placeholder="Type your question without interrupting the speaker..."
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={submitting || !questionText.trim()} className="btn-primary">
            <Plus size={16} color="#FFFFFF" />
            <span>Submit Doubt</span>
          </button>
        </div>
      </form>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E6E6FA', paddingBottom: '8px' }}>
        {(['all', 'waiting', 'answering', 'solved'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: filter === tab ? '#E6E6FA' : '#FFFFFF',
              color: filter === tab ? '#FFFFFF' : '#E6E6FA',
              textTransform: 'capitalize',
            }}
          >
            {tab} ({tab === 'all' ? doubts.length : doubts.filter((d) => d.status === tab).length})
          </button>
        ))}
      </div>

      {/* Doubts Queue List */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
          Loading doubt queue...
        </div>
      ) : filteredDoubts.length === 0 ? (
        <div className="card-secondary" style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No doubts in this queue</div>
          <div style={{ fontSize: '13px' }}>Ask any questions above to queue them for discussion!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredDoubts.map((doubt) => (
            <div
              key={doubt.id}
              className="card"
              style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
                backgroundColor: doubt.status === 'answering' ? '#F0F8FF' : '#FFFFFF',
              }}
            >
              {/* Upvote Button */}
              <button
                onClick={() => handleVote(doubt.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 12px',
                  minWidth: '54px',
                  backgroundColor: doubt.user_voted ? '#E6E6FA' : '#FFFFFF',
                  color: doubt.user_voted ? '#FFFFFF' : '#E6E6FA',
                  borderColor: '#E6E6FA',
                }}
                title={doubt.user_voted ? 'Remove upvote' : 'Upvote question'}
              >
                <ThumbsUp size={16} color={doubt.user_voted ? '#FFFFFF' : '#E6E6FA'} />
                <span style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                  {doubt.votes_count}
                </span>
              </button>

              {/* Doubt Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span className={`badge ${doubt.status === 'solved' ? '' : 'badge-outline'}`}>
                    {doubt.status}
                  </span>
                  {doubt.topic && (
                    <span className="badge-outline" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {doubt.topic}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>
                    Asked by {doubt.author_name}
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 800, color: '#E6E6FA', margin: '6px 0' }}>
                  {doubt.question}
                </div>

                {/* Host / Moderator Status Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  {isHost && (
                    <>
                      {doubt.status !== 'answering' && (
                        <button
                          onClick={() => handleStatusChange(doubt.id, 'answering')}
                          className="btn-accent"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          <Clock size={12} color="#E6E6FA" />
                          <span>Answering</span>
                        </button>
                      )}
                      {doubt.status !== 'solved' && (
                        <button
                          onClick={() => handleStatusChange(doubt.id, 'solved')}
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          <CheckCircle size={12} color="#FFFFFF" />
                          <span>Mark Solved</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleDelete(doubt.id)}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px', marginLeft: 'auto' }}
                    title="Delete doubt"
                  >
                    <Trash2 size={12} color="#E6E6FA" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
