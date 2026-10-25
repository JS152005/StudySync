import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { Timer, Play, Pause, CheckCircle, Plus, Users, Coffee } from 'lucide-react';

export const FocusSessions: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultGroupId = searchParams.get('group_id') || '';

  const { user } = useAuth();
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [initialGoal, setInitialGoal] = useState('');

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
      loadSessionDetail();
      loadSessions();
    } catch (err: any) {
      alert(err.message);
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
      loadSessionDetail();
    } catch (err: any) {
      alert(err.message);
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
      loadSessionDetail();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadSessions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const session = sessionDetail?.session;
  const isHost = sessionDetail?.isHost;
  const participants = sessionDetail?.participants || [];
  const myGoal = sessionDetail?.myGoal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Group Focus Pact
          </h1>
          <p style={{ fontSize: '13px', color: THEME.warmStone }}>
            Synchronized Pomodoro focus sessions. Lock in personal goals, study in tandem, and report outcomes.
          </p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus size={15} color={THEME.warmIvory} />
          <span>New Focus Pact</span>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="card-secondary" style={{ textAlign: 'center', padding: '48px' }}>
          <Timer size={40} color={THEME.warmStone} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', color: THEME.deepForestCharcoal }}>
            No active focus pacts
          </div>
          <p style={{ fontSize: '13px', marginBottom: '16px', color: THEME.warmStone }}>
            Start a 25-minute focus session with your study group or accountability partner!
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <span>Create Focus Pact</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Main Authoritative Timer Card */}
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '36px',
              textAlign: 'center',
              gap: '18px',
              border: `1.5px solid ${session?.phase === 'break' ? THEME.vermilion : THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
            }}
          >
            {/* Session Selector & Phase Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={session?.phase === 'break' ? 'badge badge-urgent' : 'badge'}>
                {session?.phase === 'break' ? 'Break Time' : 'Deep Focus'}
              </span>
              <span className="badge-outline">Status: {session?.status}</span>
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: THEME.deepForestCharcoal }}>{session?.subject}</h2>
              {session?.topic && <div style={{ fontSize: '13px', color: THEME.warmStone }}>{session.topic}</div>}
              <div style={{ fontSize: '12px', marginTop: '2px', color: THEME.warmStone }}>
                Host: {sessionDetail?.session?.host_name}
              </div>
            </div>

            {/* Prominent Synchronized Clock Display */}
            <div
              style={{
                fontSize: '60px',
                fontWeight: 800,
                color: THEME.deepForestCharcoal,
                letterSpacing: '0.04em',
                padding: '16px 32px',
                backgroundColor: THEME.warmIvory,
                borderRadius: '8px',
                border: `2px solid ${session?.phase === 'break' ? THEME.vermilion : THEME.emeraldGreen}`,
                width: '100%',
                maxWidth: '340px',
                fontFamily: 'monospace',
                lineHeight: 1.1,
              }}
            >
              {formatTime(remainingSeconds)}
            </div>

            {/* Timer Controls (Host controls authoritative server timer) */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {isHost ? (
                <>
                  {session?.status === 'idle' && (
                    <button onClick={() => handleTimerControl('start')} className="btn-primary">
                      <Play size={15} color={THEME.warmIvory} />
                      <span>Start Pact</span>
                    </button>
                  )}
                  {session?.status === 'running' && (
                    <button onClick={() => handleTimerControl('pause')} className="btn-secondary">
                      <Pause size={15} color={THEME.deepForestCharcoal} />
                      <span>Pause</span>
                    </button>
                  )}
                  {session?.status === 'paused' && (
                    <button onClick={() => handleTimerControl('resume')} className="btn-primary">
                      <Play size={15} color={THEME.warmIvory} />
                      <span>Resume</span>
                    </button>
                  )}
                  <button onClick={() => handleTimerControl('break')} className="btn-accent">
                    <Coffee size={15} color={THEME.warmIvory} />
                    <span>Break Mode</span>
                  </button>
                  <button onClick={() => handleTimerControl('complete')} className="btn-secondary">
                    <CheckCircle size={15} color={THEME.deepForestCharcoal} />
                    <span>End Session</span>
                  </button>
                </>
              ) : (
                <div style={{ fontSize: '12px', fontWeight: 600, color: THEME.warmStone }}>
                  Timer is controlled by host ({sessionDetail?.session?.host_name})
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Personal Goal & Participants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Personal Goal Commitment */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                backgroundColor: THEME.warmIvory,
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                My Personal Study Goal
              </h3>

              <form onSubmit={handleSaveGoal} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Finish Chapter 3 review questions 1-10..."
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  required
                />
                <button type="submit" disabled={savingGoal || !goalText.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
                  <span>Set Goal</span>
                </button>
              </form>

              {/* Goal Outcome Reporting */}
              {myGoal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                    Report Goal Outcome:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(['completed', 'partially_completed', 'not_completed'] as const).map((outcome) => {
                      const isSelected = myGoal.outcome === outcome;
                      return (
                        <button
                          key={outcome}
                          type="button"
                          onClick={() => handleReportOutcome(outcome)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '11px',
                            textTransform: 'capitalize',
                            backgroundColor: isSelected ? THEME.emeraldGreen : THEME.warmIvory,
                            color: isSelected ? THEME.warmIvory : THEME.deepForestCharcoal,
                            borderColor: isSelected ? THEME.emeraldGreen : THEME.deepForestCharcoal,
                            borderRadius: '4px',
                          }}
                        >
                          {outcome.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Participants & Their Goals */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color={THEME.emeraldGreen} />
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                  Pact Participants ({participants.length})
                </h3>
              </div>

              {participants.length === 0 ? (
                <div style={{ fontSize: '13px', color: THEME.warmStone }}>Set your goal to join this focus pact!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {participants.map((p: any) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px',
                        backgroundColor: THEME.warmIvory,
                        borderRadius: '6px',
                        border: `1px solid ${THEME.deepForestCharcoal}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: THEME.deepForestCharcoal }}>{p.full_name}</span>
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
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: THEME.deepForestCharcoal }}>
              Start Group Focus Pact
            </h2>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
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
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
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
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
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
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
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
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Initial Study Goal
                </label>
                <input
                  type="text"
                  placeholder="e.g. Complete exercises 1 through 10"
                  value={initialGoal}
                  onChange={(e) => setInitialGoal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Start Pact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
