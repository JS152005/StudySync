import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { CircularProgress } from '../components/ui/CircularProgress';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { Timer, Play, Pause, CheckCircle, Plus, Users, Coffee, Flame, Target } from 'lucide-react';

export const FocusSessions: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';
  const autoCreate = searchParams.get('action') === 'create';

  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Authoritative local countdown state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Personal Goal State
  const [goalText, setGoalText] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // New Session Modal
  const [showCreateModal, setShowCreateModal] = useState(autoCreate);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [initialGoal, setInitialGoal] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await apiRequest<{ sessions: any[] }>('/focus');
      setSessions(data.sessions);
      if (data.sessions.length > 0 && !activeSessionId) {
        setActiveSessionId(data.sessions[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetail = async () => {
    if (!activeSessionId) return;
    try {
      const data = await apiRequest(`/focus/${activeSessionId}`);
      setSessionDetail(data);

      // Reconstruct accurate remaining seconds from server authoritative state
      const remainingMs = data.timing?.remainingMs || 0;
      setRemainingSeconds(Math.ceil(remainingMs / 1000));

      if (data.myGoal) {
        setGoalText(data.myGoal.goal_text);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (autoCreate) {
      setShowCreateModal(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [autoCreate]);

  useEffect(() => {
    loadSessionDetail();
    const interval = setInterval(loadSessionDetail, 5000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  // Smooth local ticking countdown
  useEffect(() => {
    if (sessionDetail?.session?.status !== 'running') return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionDetail?.session?.status]);

  const handleTimerControl = async (action: 'start' | 'pause' | 'resume' | 'break' | 'complete') => {
    if (!activeSessionId) return;
    try {
      await apiRequest(`/focus/${activeSessionId}/control`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast.success(`Session ${action === 'break' ? 'switched to break' : action}ed`);
      loadSessionDetail();
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !goalText.trim()) return;
    setSavingGoal(true);
    try {
      await apiRequest(`/focus/${activeSessionId}/goal`, {
        method: 'POST',
        body: JSON.stringify({ goal_text: goalText.trim() }),
      });
      toast.success('Study goal committed!');
      loadSessionDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleReportOutcome = async (outcome: 'completed' | 'partially_completed' | 'not_completed') => {
    if (!activeSessionId) return;
    try {
      await apiRequest(`/focus/${activeSessionId}/outcome`, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      });
      toast.success(`Goal reported as ${outcome.replace('_', ' ')}`);
      loadSessionDetail();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiRequest<{ session: any }>('/focus', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          topic,
          focus_duration_minutes: focusMins,
          break_duration_minutes: breakMins,
          group_id: defaultGroupId || null,
          initial_goal: initialGoal,
        }),
      });
      setShowCreateModal(false);
      setSubject('');
      setTopic('');
      setInitialGoal('');
      setActiveSessionId(res.session.id);
      toast.success('Focus Pact created!');
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const session = sessionDetail?.session;
  const isHost = sessionDetail?.isHost;
  const myGoal = sessionDetail?.myGoal;
  const participants = sessionDetail?.participants || [];

  // Calculate percentage for circular countdown
  const isBreak = session?.phase === 'break';
  const totalDurationSeconds = isBreak
    ? (session?.break_duration_minutes || 5) * 60
    : (session?.focus_duration_minutes || 25) * 60;
  const progressPercent = totalDurationSeconds > 0
    ? Math.max(0, Math.min(100, ((totalDurationSeconds - remainingSeconds) / totalDurationSeconds) * 100))
    : 0;

  const outcomeOptions: SegmentOption<'completed' | 'partially_completed' | 'not_completed'>[] = [
    { value: 'completed', label: 'Completed' },
    { value: 'partially_completed', label: 'Partially' },
    { value: 'not_completed', label: 'Not Yet' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Group Focus Sessions & Pacts
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Synchronized Pomodoro study pacts. Commit to a task, start the clock, and hold each other accountable.
          </p>
        </div>

        <Button
          variant="primary"
          shape="pill"
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus size={15} color={THEME.warmIvory} />}
        >
          Create Focus Pact
        </Button>
      </div>

      {/* Active Sessions Tabs */}
      {sessions.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSessionId(s.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: THEME.radius.pill,
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 600,
                  backgroundColor: isActive ? THEME.emeraldGreen : THEME.warmIvory,
                  color: isActive ? THEME.warmIvory : THEME.deepForestCharcoal,
                  border: `1.5px solid ${isActive ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isActive && <span className="live-pulse-dot" />}
                <span>{s.subject}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Focus View */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <Skeleton height="360px" borderRadius={THEME.radius.card} />
          <Skeleton height="360px" borderRadius={THEME.radius.card} />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Timer size={36} />}
          title="No focus pacts currently active"
          description="Start a 25-minute focus session with your study group or accountability partner!"
          action={
            <Button variant="primary" shape="pill" onClick={() => setShowCreateModal(true)}>
              Create Focus Pact
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Main Synchronized Circular Timer Card */}
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '36px 24px',
              textAlign: 'center',
              gap: '20px',
              border: `1.5px solid ${isBreak ? THEME.vermilion : THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
              borderRadius: THEME.radius.cardLg,
              boxShadow: THEME.shadow.card,
            }}
          >
            {/* Session Phase & Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={isBreak ? 'badge badge-urgent' : 'badge'}>
                {isBreak ? 'Break Mode' : 'Deep Focus'}
              </span>
              <span className="badge-outline">Status: {session?.status}</span>
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                {session?.subject}
              </h2>
              {session?.topic && (
                <div style={{ fontSize: '13px', color: THEME.warmStone, marginTop: '2px' }}>
                  {session.topic}
                </div>
              )}
              <div style={{ fontSize: '12px', marginTop: '4px', color: THEME.warmStone }}>
                Host: {sessionDetail?.session?.host_name}
              </div>
            </div>

            {/* Distinctive Circular SVG Progress Ring with Monospace Clock */}
            <CircularProgress
              value={progressPercent}
              size={220}
              strokeWidth={12}
              color={isBreak ? THEME.vermilion : THEME.emeraldGreen}
              trackColor="rgba(116, 111, 100, 0.2)"
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 800,
                  color: THEME.deepForestCharcoal,
                  letterSpacing: '0.04em',
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {formatTime(remainingSeconds)}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: THEME.warmStone,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: '6px',
                }}
              >
                {isBreak ? 'Recharging' : 'Study Sprint'}
              </div>
            </CircularProgress>

            {/* Timer Controls (Host controls authoritative server timer) */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {isHost ? (
                <>
                  {session?.status === 'idle' && (
                    <Button
                      variant="primary"
                      shape="pill"
                      onClick={() => handleTimerControl('start')}
                      leftIcon={<Play size={15} color={THEME.warmIvory} />}
                    >
                      Start Pact
                    </Button>
                  )}
                  {session?.status === 'running' && (
                    <Button
                      variant="secondary"
                      shape="pill"
                      onClick={() => handleTimerControl('pause')}
                      leftIcon={<Pause size={15} color={THEME.deepForestCharcoal} />}
                    >
                      Pause
                    </Button>
                  )}
                  {session?.status === 'paused' && (
                    <Button
                      variant="primary"
                      shape="pill"
                      onClick={() => handleTimerControl('resume')}
                      leftIcon={<Play size={15} color={THEME.warmIvory} />}
                    >
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="accent"
                    shape="pill"
                    onClick={() => handleTimerControl('break')}
                    leftIcon={<Coffee size={15} color={THEME.warmIvory} />}
                  >
                    Break Mode
                  </Button>
                  <Button
                    variant="secondary"
                    shape="pill"
                    onClick={() => handleTimerControl('complete')}
                    leftIcon={<CheckCircle size={15} color={THEME.deepForestCharcoal} />}
                  >
                    End Session
                  </Button>
                </>
              ) : (
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: THEME.warmStone }}>
                  Timer is controlled by host ({sessionDetail?.session?.host_name})
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Personal Goal Commitment & Participants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Personal Goal Commitment */}
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
                <Target size={18} color={THEME.emeraldGreen} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  My Personal Study Goal
                </h3>
              </div>

              <form onSubmit={handleSaveGoal} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Finish Chapter 3 review questions 1-10..."
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingGoal || !goalText.trim()}
                  loading={savingGoal}
                  style={{ flexShrink: 0 }}
                >
                  Set Goal
                </Button>
              </form>

              {/* Goal Outcome Reporting via SegmentedControl */}
              {myGoal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                    Report Goal Outcome:
                  </div>
                  <SegmentedControl
                    options={outcomeOptions}
                    value={myGoal.outcome as any}
                    onChange={(val) => handleReportOutcome(val)}
                    size="sm"
                    variant="pill"
                  />
                </div>
              )}
            </div>

            {/* Participants & Their Goals */}
            <div
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color={THEME.emeraldGreen} />
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                    Pact Participants ({participants.length})
                  </h3>
                </div>
                <span className="live-pulse-dot" />
              </div>

              {participants.length === 0 ? (
                <div style={{ fontSize: '13px', color: THEME.warmStone, fontStyle: 'italic' }}>
                  Set your personal goal above to join this focus pact!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {participants.map((p: any) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: THEME.warmIvory,
                        borderRadius: THEME.radius.md,
                        border: `1px solid ${THEME.deepForestCharcoal}`,
                        boxShadow: THEME.shadow.subtle,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                          {p.full_name}
                        </span>
                        <span className="badge" style={{ fontSize: '10px' }}>
                          {p.outcome.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: THEME.warmStone }}>"{p.goal_text}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Focus Session Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Start Group Focus Pact"
        description="Schedule a focused work period with synchronized Pomodoro breaks."
      >
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              placeholder="e.g. Engineering Mathematics"
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
              Topic
            </label>
            <input
              type="text"
              placeholder="e.g. Fourier Transforms & Differential Equations"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                Focus Duration (mins)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={focusMins}
                onChange={(e) => setFocusMins(parseInt(e.target.value, 10))}
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
                Break Duration (mins)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={breakMins}
                onChange={(e) => setBreakMins(parseInt(e.target.value, 10))}
              />
            </div>
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
              Initial Study Goal
            </label>
            <input
              type="text"
              placeholder="e.g. Complete exercises 1 through 10"
              value={initialGoal}
              onChange={(e) => setInitialGoal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Start Pact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FocusSessions;
