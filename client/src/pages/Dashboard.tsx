import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { CircularProgress } from '../components/ui/CircularProgress';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  CalendarDays,
  CheckCircle,
  UsersRound,
  Video,
  ListTodo,
  HelpCircle,
  Plus,
  ArrowRight,
  Sparkles,
  Flame,
  Clock,
  BookOpen,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/exams/dashboard-summary')
      .then((res) => setData(res))
      .catch((err) => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Skeleton height="110px" borderRadius={THEME.radius.card} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Skeleton height="120px" borderRadius={THEME.radius.card} />
          <Skeleton height="120px" borderRadius={THEME.radius.card} />
          <Skeleton height="120px" borderRadius={THEME.radius.card} />
          <Skeleton height="120px" borderRadius={THEME.radius.card} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          <Skeleton height="260px" borderRadius={THEME.radius.card} />
          <Skeleton height="260px" borderRadius={THEME.radius.card} />
        </div>
      </div>
    );
  }

  const upcomingExams = data?.upcomingExams || [];
  const todayTasks = data?.todayTasks || [];
  const liveRooms = data?.liveRooms || [];
  const syllabus = data?.syllabus || { total: 0, completed: 0, percentage: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner with Next Priority CTA */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          padding: '24px 28px',
          backgroundColor: THEME.warmIvory,
          border: `2px solid ${THEME.emeraldGreen}`,
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
        }}
      >
        <div style={{ minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: THEME.radius.full,
                backgroundColor: 'rgba(0, 107, 79, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} color={THEME.emeraldGreen} />
            </div>
            <h1
              style={{
                fontSize: '23px',
                fontWeight: 800,
                color: THEME.deepForestCharcoal,
                letterSpacing: '-0.02em',
              }}
            >
              Welcome back, {user?.full_name}!
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: THEME.warmStone, fontWeight: 500 }}>
            {user?.college ? `${user.college} • ` : ''}
            {user?.course || 'Student'} • Academic Year {user?.academic_year || '1'}
          </p>
        </div>

        {/* Priority Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <NavLink to="/rooms" className="btn-primary btn-pill">
            <Video size={16} color={THEME.warmIvory} />
            <span>Launch Study Room</span>
          </NavLink>
          <NavLink to="/focus" className="btn-secondary btn-pill">
            <Flame size={16} color={THEME.vermilion} />
            <span>Focus Session</span>
          </NavLink>
        </div>
      </div>

      {/* Metrics Grid with Interactive Hover */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Metric 1: Syllabus Progress with Circular Meter */}
        <NavLink
          to="/syllabus"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: THEME.warmStone,
                marginBottom: '4px',
              }}
            >
              Syllabus Mastery
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: THEME.deepForestCharcoal,
                fontFamily: 'var(--font-serif)',
                lineHeight: 1.1,
              }}
            >
              {syllabus.percentage}%
            </div>
            <div style={{ fontSize: '11.5px', color: THEME.warmStone, marginTop: '4px' }}>
              {syllabus.completed} of {syllabus.total} covered
            </div>
          </div>
          <CircularProgress
            value={syllabus.percentage}
            size={56}
            strokeWidth={5}
            color={THEME.emeraldGreen}
          >
            <ListTodo size={18} color={THEME.emeraldGreen} />
          </CircularProgress>
        </NavLink>

        {/* Metric 2: Active Groups */}
        <NavLink
          to="/groups"
          className="card card-interactive"
          style={{ textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: THEME.warmStone,
              }}
            >
              Study Groups
            </span>
            <UsersRound size={18} color={THEME.emeraldGreen} />
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: THEME.deepForestCharcoal,
              fontFamily: 'var(--font-serif)',
              marginBottom: '4px',
            }}
          >
            {data?.activeGroupsCount || 0}
          </div>
          <div style={{ fontSize: '12px', color: THEME.warmStone }}>Active peer circles</div>
        </NavLink>

        {/* Metric 3: Open Doubts */}
        <NavLink
          to="/rooms"
          className="card card-interactive"
          style={{ textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: THEME.warmStone,
              }}
            >
              Unresolved Doubts
            </span>
            <HelpCircle size={18} color={data?.openDoubtsCount > 0 ? THEME.vermilion : THEME.deepForestCharcoal} />
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: data?.openDoubtsCount > 0 ? THEME.vermilion : THEME.deepForestCharcoal,
              fontFamily: 'var(--font-serif)',
              marginBottom: '4px',
            }}
          >
            {data?.openDoubtsCount || 0}
          </div>
          <div style={{ fontSize: '12px', color: THEME.warmStone }}>Questions queued for discussion</div>
        </NavLink>

        {/* Metric 4: Upcoming Exams */}
        <NavLink
          to="/exams"
          className="card card-interactive"
          style={{ textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: THEME.warmStone,
              }}
            >
              Upcoming Exams
            </span>
            <CalendarDays size={18} color={upcomingExams.length > 0 ? THEME.vermilion : THEME.deepForestCharcoal} />
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: THEME.deepForestCharcoal,
              fontFamily: 'var(--font-serif)',
              marginBottom: '4px',
            }}
          >
            {upcomingExams.length}
          </div>
          <div style={{ fontSize: '12px', color: THEME.warmStone }}>Scheduled milestones</div>
        </NavLink>
      </div>

      {/* Main Dashboard Rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Planned Study Tasks */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color={THEME.emeraldGreen} />
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Today's Study Tasks
              </h2>
            </div>
            <NavLink to="/exams" style={{ fontSize: '12px', color: THEME.emeraldGreen, fontWeight: 700 }}>
              View All
            </NavLink>
          </div>

          {todayTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle size={24} />}
              title="No pending tasks today"
              description="Keep up the momentum! Schedule your revision milestones or syllabus tasks."
              action={
                <NavLink to="/exams" className="btn-secondary btn-sm">
                  <Plus size={14} color={THEME.deepForestCharcoal} />
                  <span>Add Study Task</span>
                </NavLink>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayTasks.map((t: any) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.md,
                    border: `1px solid ${THEME.deepForestCharcoal}`,
                    transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: THEME.deepForestCharcoal }}>
                    {t.title}
                  </span>
                  <span className={t.priority === 'high' ? 'badge badge-urgent' : 'badge'}>
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Study Sessions */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: THEME.radius.full,
                  backgroundColor: 'rgba(0, 107, 79, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Video size={14} color={THEME.emeraldGreen} />
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Live Study Rooms
              </h2>
            </div>
            <NavLink to="/rooms" style={{ fontSize: '12px', color: THEME.emeraldGreen, fontWeight: 700 }}>
              Browse All
            </NavLink>
          </div>

          {liveRooms.length === 0 ? (
            <EmptyState
              icon={<Video size={24} />}
              title="No active sessions right now"
              description="Start an instant study room to collaborate on exam topics or share your whiteboard."
              action={
                <NavLink to="/rooms" className="btn-primary btn-sm">
                  <span>Create a Study Room</span>
                </NavLink>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liveRooms.map((r: any) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: THEME.warmIvory,
                    borderRadius: THEME.radius.md,
                    border: `1px solid ${THEME.deepForestCharcoal}`,
                    transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="live-pulse-dot" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: THEME.warmStone }}>
                        Host: {r.host_name} • {r.subject || 'General'}
                      </div>
                    </div>
                  </div>
                  <NavLink
                    to={`/rooms/${r.id}`}
                    className="btn-primary btn-sm btn-pill"
                    style={{ padding: '5px 12px', fontSize: '11.5px' }}
                  >
                    <span>Join</span>
                    <ArrowRight size={12} color={THEME.warmIvory} />
                  </NavLink>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
