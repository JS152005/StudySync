import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from './ui/Button';
import { SegmentedControl, SegmentOption } from './ui/SegmentedControl';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { useToast } from './ui/ToastContext';
import { triggerSparks } from './ui/SparkEffect';
import {
  ThumbsUp,
  CheckCircle2,
  Clock,
  HelpCircle,
  Trash2,
  Plus,
  Sparkles,
  MessageCircleQuestion,
  Info,
} from 'lucide-react';

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

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
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

  const handleVote = async (doubtId: string, e: React.MouseEvent) => {
    try {
      const res = await apiRequest<{ votes_count: number; user_voted: number }>(`/doubts/${doubtId}/vote`, {
        method: 'POST',
      });
      if (res.user_voted) {
        triggerSparks(e, 'azure', 10);
      }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Submit Doubt Form Card */}
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '3px solid #0284C7',
          borderRadius: THEME.radius.cardLg,
          padding: '24px',
        }}
      >
        {/* Form Title & Context */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38BDF8',
              }}
            >
              <HelpCircle size={18} color="#38BDF8" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                Ask a Question to the Queue
              </h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', margin: 0 }}>
                Peers and moderators can upvote and mark questions as answering or resolved.
              </p>
            </div>
          </div>
        </div>

        {/* Topic Input */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#F8FAFC',
              marginBottom: '6px',
            }}
          >
            Topic or Concept (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Dijkstra edge cases, Bayes theorem, Circuit nodal analysis..."
            value={topicText}
            onChange={(e) => setTopicText(e.target.value)}
          />
        </div>

        {/* Question Textarea */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#F8FAFC',
              marginBottom: '6px',
            }}
          >
            Your Question *
          </label>
          <textarea
            rows={3}
            placeholder="Type your question clearly so group members can address it effectively..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Form Action Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94A3B8' }}>
            <Info size={14} color="#94A3B8" />
            <span>Questions are prioritized by community upvotes</span>
          </div>

          <Button
            type="submit"
            variant="primary"
            shape="pill"
            size="md"
            disabled={!questionText.trim()}
            loading={submitting}
            leftIcon={<Plus size={16} color="#FFFFFF" />}
          >
            Queue Question
          </Button>
        </div>
      </form>

      {/* Filter Tabs using SegmentedControl */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <SegmentedControl
          options={filterOptions}
          value={filter}
          onChange={(val) => setFilter(val)}
          variant="pill"
          size="sm"
        />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
          Showing {filteredDoubts.length} {filteredDoubts.length === 1 ? 'question' : 'questions'}
        </span>
      </div>

      {/* Doubts Queue List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Skeleton height="88px" borderRadius={THEME.radius.card} />
          <Skeleton height="88px" borderRadius={THEME.radius.card} />
        </div>
      ) : filteredDoubts.length === 0 ? (
        <EmptyState
          icon={<MessageCircleQuestion size={32} />}
          title="No questions in this view"
          description="Submit a question above to start a live discussion queue with your study group!"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDoubts.map((doubt) => {
            const isAnswering = doubt.status === 'answering';
            const isSolved = doubt.status === 'solved';

            return (
              <div
                key={doubt.id}
                className="card"
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  backgroundColor: '#FFFFFF',
                  border: isAnswering
                    ? '1.5px solid #F43F5E'
                    : isSolved
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid #E2E8F0',
                  borderRadius: THEME.radius.card,
                  padding: '18px 20px',
                  transition: `all ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
                }}
              >
                {/* Upvote Button with Tactile Hover & Scale */}
                <button
                  type="button"
                  onClick={(e) => handleVote(doubt.id, e)}
                  className={`upvote-drawn-card ${doubt.user_voted ? 'voted' : ''}`}
                  title={doubt.user_voted ? 'Remove upvote' : 'Upvote question'}
                  aria-label={`Upvote question, current count: ${doubt.votes_count}`}
                  style={{
                    flexShrink: 0,
                    width: '54px',
                    padding: '8px 6px',
                  }}
                >
                  <ThumbsUp
                    size={16}
                    color={doubt.user_voted ? '#38BDF8' : '#94A3B8'}
                    strokeWidth={doubt.user_voted ? 2.4 : 1.8}
                  />
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      marginTop: '3px',
                      color: doubt.user_voted ? '#38BDF8' : '#94A3B8',
                      lineHeight: 1,
                    }}
                  >
                    {doubt.votes_count}
                  </span>
                </button>

                {/* Doubt Details Column */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Meta Tag Line */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginBottom: '6px',
                    }}
                  >
                    {/* Status Badge */}
                    {isSolved && (
                      <span className="badge badge-success" style={{ gap: '4px' }}>
                        <CheckCircle2 size={12} color="#34D399" />
                        Solved
                      </span>
                    )}
                    {isAnswering && (
                      <span className="badge badge-urgent" style={{ gap: '4px' }}>
                        <Sparkles size={12} color="#FB7185" />
                        Answering Now
                      </span>
                    )}
                    {doubt.status === 'waiting' && (
                      <span className="badge-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} color="#94A3B8" />
                        Waiting
                      </span>
                    )}

                    {doubt.topic && (
                      <span className="badge-stone">
                        {doubt.topic}
                      </span>
                    )}

                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', marginLeft: 'auto' }}>
                      Asked by <strong style={{ color: '#F8FAFC' }}>{doubt.author_name}</strong> • {formatTimeAgo(doubt.created_at)}
                    </span>
                  </div>

                  {/* Question Text */}
                  <div
                    style={{
                      fontSize: '14.5px',
                      fontWeight: 600,
                      color: '#F8FAFC',
                      lineHeight: 1.5,
                      margin: '6px 0 10px 0',
                    }}
                  >
                    {doubt.question}
                  </div>

                  {/* Moderator / Host Controls & Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
                    {isHost && (
                      <>
                        {!isAnswering && (
                          <Button
                            variant="vermilion"
                            size="sm"
                            shape="pill"
                            onClick={() => handleStatusChange(doubt.id, 'answering')}
                            leftIcon={<Sparkles size={12} color="#FFFFFF" />}
                          >
                            Answer Now
                          </Button>
                        )}
                        {!isSolved && (
                          <Button
                            variant="mint"
                            size="sm"
                            shape="pill"
                            onClick={() => handleStatusChange(doubt.id, 'solved')}
                            leftIcon={<CheckCircle2 size={12} color="#FFFFFF" />}
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
                      aria-label="Delete question"
                      title="Delete question from queue"
                    >
                      <Trash2 size={14} color="#94A3B8" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DoubtQueue;
