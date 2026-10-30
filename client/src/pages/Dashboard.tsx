import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { CircularProgress } from '../components/ui/CircularProgress';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { triggerSparks } from '../components/ui/SparkEffect';
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
  ChevronDown,
  Timer,
  Zap,
  Clock,
  BookOpen,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Minimal consolidated action dropdown state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  // Unified activity console tab state: 'tasks' | 'rooms' | 'exams'
  const [activeTab, setActiveTab] = useState<'tasks' | 'rooms' | 'exams'>('tasks');

  useEffect(() => {
    apiRequest('/exams/dashboard-summary')
      .then((res) => setData(res))
      .catch((err) => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    if (actionMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [actionMenuOpen]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Skeleton height="110px" borderRadius={THEME.radius.cardLg} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Skeleton height="110px" borderRadius={THEME.radius.card} />
          <Skeleton height="110px" borderRadius={THEME.radius.card} />
          <Skeleton height="110px" borderRadius={THEME.radius.card} />
          <Skeleton height="110px" borderRadius={THEME.radius.card} />
        </div>
        <Skeleton height="340px" borderRadius={THEME.radius.card} />
      </div>
    );
  }

  const upcomingExams = data?.upcomingExams || [];
  const todayTasks = data?.todayTasks || [];
  const liveRooms = data?.liveRooms || [];
  const syllabus = data?.syllabus || { total: 0, completed: 0, percentage: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Welcome Header Banner with Minimalised Quick Action Launcher */}
      <div
        className="card-featured"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
          border: '1px solid #E2E8F0',
          borderTop: '3px solid #0284C7',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.card,
        }}
      >
        <div style={{ minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="#0284C7" />
            </div>
            <h1
              className="animate-shimmer"
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Welcome back, {user?.full_name}!
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', fontWeight: 500, margin: 0 }}>
            {user?.college ? `${user.college} • ` : ''}
            {user?.course || 'Student'} • Year {user?.academic_year || '1'} •{' '}
            <span style={{ color: '#0F172A', fontWeight: 700 }}>{todayTasks.length} tasks scheduled today</span>
          </p>
        </div>

        {/* Minimalised Single Action Button with Animated Menu */}
        <div style={{ position: 'relative' }} ref={actionMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              triggerSparks(e, 'azure', 8);
              setActionMenuOpen((prev) => !prev);
            }}
            className="btn-primary"
            style={{
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 700,
              borderRadius: THEME.radius.pill,
              gap: '8px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
            }}
          >
            <Zap size={16} color="#FFFFFF" />
            <span>Launch Activity</span>
            <ChevronDown
              size={15}
              color="#FFFFFF"
              style={{
                transform: actionMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </button>

          {/* Minimalised Popover Dropdown */}
          {actionMenuOpen && (
            <div
              className="quick-action-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '260px',
                backgroundColor: '#FFFFFF',
                borderRadius: THEME.radius.card,
                border: '1px solid #E2E8F0',
                boxShadow: THEME.shadow.lifted,
                padding: '8px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate('/rooms?action=create');
                }}
                className="btn-ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  gap: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Video size={16} color="#0284C7" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div>Create Study Room</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Live peer video & whiteboard</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate('/focus?action=create');
                }}
                className="btn-ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  gap: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Timer size={16} color="#F43F5E" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div>Start Focus Sprint</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Pomodoro with lock-in</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate('/syllabus?action=create');
                }}
                className="btn-ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  gap: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ListTodo size={16} color="#10B981" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div>New Syllabus Goal</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Track chapters & progress</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionMenuOpen(false);
                  navigate('/exams');
                }}
                className="btn-ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: THEME.radius.md,
                  gap: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CalendarDays size={16} color="#F59E0B" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div>Schedule Exam / Task</div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Set deadlines & milestones</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid with Light Interactive Hover Physics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Metric 1: Syllabus Progress */}
        <NavLink
          to="/syllabus"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748B',
                marginBottom: '4px',
              }}
            >
              Syllabus Mastery
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#0F172A',
                lineHeight: 1.1,
              }}
            >
              {syllabus.percentage}%
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
              {syllabus.completed} of {syllabus.total} covered
            </div>
          </div>
          <CircularProgress
            value={syllabus.percentage}
            size={52}
            strokeWidth={5}
            color="#0284C7"
          >
            <ListTodo size={17} color="#0284C7" />
          </CircularProgress>
        </NavLink>

        {/* Metric 2: Active Groups */}
        <NavLink
          to="/groups"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748B',
              }}
            >
              Study Groups
            </span>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UsersRound size={16} color="#0284C7" />
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#0F172A',
              marginBottom: '4px',
            }}
          >
            {data?.activeGroupsCount || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>Active peer circles</div>
        </NavLink>

        {/* Metric 3: Open Doubts */}
        <NavLink
          to="/rooms"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748B',
              }}
            >
              Unresolved Doubts
            </span>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: data?.openDoubtsCount > 0 ? 'rgba(244, 63, 94, 0.1)' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HelpCircle size={16} color={data?.openDoubtsCount > 0 ? '#F43F5E' : '#64748B'} />
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: data?.openDoubtsCount > 0 ? '#E11D48' : '#0F172A',
              marginBottom: '4px',
            }}
          >
            {data?.openDoubtsCount || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>Questions queued for discussion</div>
        </NavLink>

        {/* Metric 4: Upcoming Exams */}
        <NavLink
          to="/exams"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748B',
              }}
            >
              Upcoming Exams
            </span>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: upcomingExams.length > 0 ? 'rgba(244, 63, 94, 0.1)' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={16} color={upcomingExams.length > 0 ? '#F43F5E' : '#64748B'} />
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#0F172A',
              marginBottom: '4px',
            }}
          >
            {upcomingExams.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>Scheduled milestones</div>
        </NavLink>
      </div>

      {/* Unified Study Activity Console (Consolidated Tabbed Layout) */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.cardLg,
          padding: '24px',
          boxShadow: THEME.shadow.card,
        }}
      >
        {/* Console Header & Animated Tab Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Study Activity Console
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0' }}>
              Real-time synchronization across your daily tasks, live peer rooms, and exam deadlines.
            </p>
          </div>

          {/* Animated Tab Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F1F5F9',
              borderRadius: THEME.radius.pill,
              padding: '4px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              style={{
                border: 'none',
                height: '32px',
                padding: '0 14px',
                borderRadius: THEME.radius.pill,
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: activeTab === 'tasks' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'tasks' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'tasks' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <CheckCircle size={14} color={activeTab === 'tasks' ? '#0284C7' : '#64748B'} />
              <span>Today's Tasks</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: activeTab === 'tasks' ? 'rgba(2, 132, 199, 0.12)' : '#E2E8F0',
                  color: activeTab === 'tasks' ? '#0284C7' : '#64748B',
                  fontWeight: 700,
                }}
              >
                {todayTasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              style={{
                border: 'none',
                height: '32px',
                padding: '0 14px',
                borderRadius: THEME.radius.pill,
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: activeTab === 'rooms' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'rooms' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'rooms' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} />
              <span>Live Rooms</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: activeTab === 'rooms' ? 'rgba(16, 185, 129, 0.12)' : '#E2E8F0',
                  color: activeTab === 'rooms' ? '#10B981' : '#64748B',
                  fontWeight: 700,
                }}
              >
                {liveRooms.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              style={{
                border: 'none',
                height: '32px',
                padding: '0 14px',
                borderRadius: THEME.radius.pill,
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: activeTab === 'exams' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'exams' ? '#0F172A' : '#64748B',
                boxShadow: activeTab === 'exams' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <CalendarDays size={14} color={activeTab === 'exams' ? '#F43F5E' : '#64748B'} />
              <span>Exams</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: activeTab === 'exams' ? 'rgba(244, 63, 94, 0.12)' : '#E2E8F0',
                  color: activeTab === 'exams' ? '#F43F5E' : '#64748B',
                  fontWeight: 700,
                }}
              >
                {upcomingExams.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1 Content: Today's Tasks */}
        {activeTab === 'tasks' && (
          <div className="tab-content-active" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Assigned milestones for today
              </span>
              <NavLink to="/exams" style={{ fontSize: '12.5px', color: '#0284C7', fontWeight: 700 }}>
                Manage All Tasks &rarr;
              </NavLink>
            </div>

            {todayTasks.length === 0 ? (
              <EmptyState
                icon={<CheckCircle size={24} />}
                title="No pending tasks today"
                description="Keep up your learning momentum! Add a revision milestone or chapter study task."
                action={
                  <NavLink to="/exams" className="btn-secondary btn-sm" style={{ gap: '6px' }}>
                    <Plus size={14} color="#0F172A" />
                    <span>Add Study Task</span>
                  </NavLink>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todayTasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: THEME.radius.md,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle size={16} color="#0284C7" />
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>
                        {t.title}
                      </span>
                    </div>
                    <span className={t.priority === 'high' ? 'badge badge-urgent' : 'badge'}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Live Study Rooms */}
        {activeTab === 'rooms' && (
          <div className="tab-content-active" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Real-time active collaborative spaces
              </span>
              <NavLink to="/rooms" style={{ fontSize: '12.5px', color: '#0284C7', fontWeight: 700 }}>
                Explore All Rooms &rarr;
              </NavLink>
            </div>

            {liveRooms.length === 0 ? (
              <EmptyState
                icon={<Video size={24} />}
                title="No active sessions right now"
                description="Start an instant study room to collaborate on exam topics or solve doubts together on the whiteboard."
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      triggerSparks(e, 'azure', 10);
                      navigate('/rooms?action=create');
                    }}
                    className="btn-primary btn-sm"
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <span>Create a Study Room</span>
                  </button>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {liveRooms.map((r: any) => (
                  <div
                    key={r.id}
                    className="item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: THEME.radius.md,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="live-pulse-dot" />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          Host: {r.host_name} • {r.subject || 'General'}
                        </div>
                      </div>
                    </div>
                    <NavLink
                      to={`/rooms/${r.id}`}
                      className="btn-primary btn-sm btn-pill"
                      style={{ padding: '6px 14px', fontSize: '12px', gap: '4px' }}
                      onClick={(e) => triggerSparks(e, 'azure', 8)}
                    >
                      <span>Join Room</span>
                      <ArrowRight size={13} color="#FFFFFF" />
                    </NavLink>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3 Content: Upcoming Exams */}
        {activeTab === 'exams' && (
          <div className="tab-content-active" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Upcoming syllabus deadlines & exams
              </span>
              <NavLink to="/exams" style={{ fontSize: '12.5px', color: '#0284C7', fontWeight: 700 }}>
                Exam Calendar &rarr;
              </NavLink>
            </div>

            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="No upcoming exams scheduled"
                description="Keep your semester organized by adding your midterms, finals, or quiz dates."
                action={
                  <NavLink to="/exams" className="btn-secondary btn-sm" style={{ gap: '6px' }}>
                    <Plus size={14} color="#0F172A" />
                    <span>Schedule an Exam</span>
                  </NavLink>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingExams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="item-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: THEME.radius.md,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(244, 63, 94, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BookOpen size={16} color="#F43F5E" />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          {exam.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} color="#64748B" />
                          <span>{exam.exam_date || 'Date TBD'} • {exam.course_code || 'General'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-urgent">
                      {exam.days_left !== undefined ? `${exam.days_left}d left` : 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
