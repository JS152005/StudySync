import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import { SegmentedControl, SegmentOption } from './ui/SegmentedControl';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { useToast } from './ui/ToastContext';
import { ThumbsUp, CheckCircle, Clock, HelpCircle, Trash2, Plus, Sparkles, MessageCircleQuestion } from 'lucide-react';

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
  const toast = useToast();
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
      toast.info(res.user_voted ? 'Upvoted question' : 'Removed upvote');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (doubtId: string, newStatus: string) => {
    try {
      await apiRequest(`/doubts/${doubtId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Doubt marked as ${newStatus}`);
      loadDoubts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (doubtId: string) => {
    try {
      await apiRequest(`/doubts/${doubtId}`, { method: 'DELETE' });
      setDoubts((prev) => prev.filter((d) => d.id !== doubtId));
      toast.info('Doubt deleted');
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success('Question added to queue!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDoubts = doubts.filter((d) => (filter === 'all' ? true : d.status === filter));

  const filterOptions: SegmentOption<'all' | 'waiting' | 'answering' | 'solved'>[] = [
    { value: 'all', label: 'All', count: doubts.length },
    { value: 'waiting', label: 'Waiting', count: doubts.filter((d) => d.status === 'waiting').length },
    { value: 'answering', label: 'Answering', count: doubts.filter((d) => d.status === 'answering').length },
    { value: 'solved', label: 'Solved', count: doubts.filter((d) => d.status === 'solved').length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Submit Doubt Form */}
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={18} color={THEME.emeraldGreen} />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: THEME.deepForestCharcoal,
              fontFamily: 'var(--font-serif)',
            }}
          >
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
          <Button
            type="submit"
            variant="primary"
            shape="pill"
            size="sm"
            disabled={!questionText.trim()}
            loading={submitting}
            leftIcon={<Plus size={15} color={THEME.warmIvory} />}
          >
            Submit Doubt
          </Button>
        </div>
      </form>

      {/* Filter Tabs using SegmentedControl */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SegmentedControl
          options={filterOptions}
          value={filter}
          onChange={(val) => setFilter(val)}
          variant="pill"
          size="sm"
        />
      </div>

      {/* Doubts Queue List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Skeleton height="80px" borderRadius={THEME.radius.card} />
          <Skeleton height="80px" borderRadius={THEME.radius.card} />
        </div>
      ) : filteredDoubts.length === 0 ? (
        <EmptyState
          icon={<MessageCircleQuestion size={28} />}
          title="No doubts in this queue"
          description="Ask any questions above to queue them for peer discussion and resolution!"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDoubts.map((doubt) => (
            <div
              key={doubt.id}
              className="card"
              style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
                backgroundColor: THEME.warmIvory,
                border: `1.5px solid ${doubt.status === 'answering' ? THEME.vermilion : THEME.deepForestCharcoal}`,
                borderRadius: THEME.radius.card,
                boxShadow: doubt.status === 'answering' ? THEME.shadow.lifted : THEME.shadow.card,
                transition: `all ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
              }}
            >
              {/* Upvote Button with Tactile Scale Feedback */}
              <button
                type="button"
                onClick={() => handleVote(doubt.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '8px 12px',
                  minWidth: '56px',
                  backgroundColor: doubt.user_voted ? THEME.emeraldGreen : THEME.warmIvory,
                  color: doubt.user_voted ? THEME.warmIvory : THEME.deepForestCharcoal,
                  border: `1.5px solid ${doubt.user_voted ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                  borderRadius: THEME.radius.md,
                  cursor: 'pointer',
                  transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}, background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                }}
                className="btn"
                title={doubt.user_voted ? 'Remove upvote' : 'Upvote question'}
                aria-label={`Upvote question, current count: ${doubt.votes_count}`}
              >
                <ThumbsUp size={16} color={doubt.user_voted ? THEME.warmIvory : THEME.deepForestCharcoal} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    marginTop: '2px',
                    color: doubt.user_voted ? THEME.warmIvory : THEME.deepForestCharcoal,
                  }}
                >
                  {doubt.votes_count}
                </span>
              </button>

              {/* Doubt Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {/* Status Badge */}
                  {doubt.status === 'solved' && (
                    <span className="badge" style={{ gap: '4px' }}>
                      <CheckCircle size={11} color={THEME.warmIvory} />
                      Solved
                    </span>
                  )}
                  {doubt.status === 'answering' && (
                    <span className="badge badge-urgent" style={{ gap: '4px' }}>
                      <Sparkles size={11} color={THEME.warmIvory} />
                      Answering Now
                    </span>
                  )}
                  {doubt.status === 'waiting' && (
                    <span className="badge-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} color={THEME.deepForestCharcoal} />
                      Waiting
                    </span>
                  )}

                  {doubt.topic && (
                    <span className="badge-stone">
                      {doubt.topic}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: THEME.warmStone }}>
                    Asked by {doubt.author_name}
                  </span>
                </div>

                <div style={{ fontSize: '15px', fontWeight: 700, color: THEME.deepForestCharcoal, margin: '6px 0' }}>
                  {doubt.question}
                </div>

                {/* Host / Moderator Status Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  {isHost && (
                    <>
                      {doubt.status !== 'answering' && (
                        <Button
                          variant="accent"
                          size="sm"
                          shape="pill"
                          onClick={() => handleStatusChange(doubt.id, 'answering')}
                          leftIcon={<Sparkles size={12} color={THEME.warmIvory} />}
                        >
                          Answering
                        </Button>
                      )}
                      {doubt.status !== 'solved' && (
                        <Button
                          variant="primary"
                          size="sm"
                          shape="pill"
                          onClick={() => handleStatusChange(doubt.id, 'solved')}
                          leftIcon={<CheckCircle size={12} color={THEME.warmIvory} />}
                        >
                          Mark Solved
                        </Button>
                      )}
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    shape="pill"
                    onClick={() => handleDelete(doubt.id)}
                    style={{ marginLeft: 'auto' }}
                    aria-label="Delete question"
                  >
                    <Trash2 size={13} color={THEME.warmStone} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoubtQueue;
