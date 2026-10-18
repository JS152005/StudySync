import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  const upcomingExams = data?.upcomingExams || [];
  const todayTasks = data?.todayTasks || [];
  const liveRooms = data?.liveRooms || [];
  const syllabus = data?.syllabus || { total: 0, completed: 0, percentage: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div
        className="card-secondary"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={20} color="#E6E6FA" />
            <h1 style={{ fontSize: '24px', fontWeight: 900 }}>
              Welcome back, {user?.full_name}!
            </h1>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700 }}>
            {user?.college ? `${user.college} • ` : ''}{user?.course || 'Student'} • Academic Year {user?.academic_year || '1'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <NavLink to="/rooms" className="btn-primary">
            <Video size={16} color="#FFFFFF" />
            <span>Start Study Room</span>
          </NavLink>
          <NavLink to="/focus" className="btn-secondary">
            <span>Focus Session</span>
          </NavLink>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Metric 1: Syllabus Progress */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Syllabus Mastery</span>
            <ListTodo size={18} color="#E6E6FA" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>
            {syllabus.percentage}%
          </div>
          <div style={{ fontSize: '12px' }}>
            {syllabus.completed} of {syllabus.total} topics covered
          </div>
        </div>

        {/* Metric 2: Active Groups */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Study Groups</span>
            <UsersRound size={18} color="#E6E6FA" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>
            {data?.activeGroupsCount || 0}
          </div>
          <div style={{ fontSize: '12px' }}>Active peer communities</div>
        </div>

        {/* Metric 3: Open Doubts */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Unresolved Doubts</span>
            <HelpCircle size={18} color="#E6E6FA" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>
            {data?.openDoubtsCount || 0}
          </div>
          <div style={{ fontSize: '12px' }}>Questions queued for discussion</div>
        </div>

        {/* Metric 4: Upcoming Exams */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Upcoming Exams</span>
            <CalendarDays size={18} color="#E6E6FA" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>
            {upcomingExams.length}
          </div>
          <div style={{ fontSize: '12px' }}>Scheduled exams & tests</div>
        </div>
      </div>

      {/* Main Dashboard Rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Planned Study Tasks */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="#E6E6FA" />
              <h2 style={{ fontSize: '16px', fontWeight: 900 }}>Today's Study Tasks</h2>
            </div>
            <NavLink to="/exams" style={{ fontSize: '12px' }}>View All</NavLink>
          </div>

          {todayTasks.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>No pending tasks scheduled for today.</div>
              <NavLink to="/exams" className="btn-secondary" style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px' }}>
                <Plus size={14} color="#E6E6FA" />
                <span>Add Study Task</span>
              </NavLink>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayTasks.map((t: any) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: '#F0F8FF',
                    borderRadius: '8px',
                    border: '1px solid #E6E6FA',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800 }}>{t.title}</span>
                  <span className="badge">{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Study Sessions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={18} color="#E6E6FA" />
              <h2 style={{ fontSize: '16px', fontWeight: 900 }}>Live Study Rooms</h2>
            </div>
            <NavLink to="/rooms" style={{ fontSize: '12px' }}>Browse</NavLink>
          </div>

          {liveRooms.length === 0 ? (
            <div className="card-secondary" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>No active study sessions currently running.</div>
              <NavLink to="/rooms" className="btn-primary" style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '12px' }}>
                <span>Create a Study Room</span>
              </NavLink>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liveRooms.map((r: any) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: '#F0F8FF',
                    borderRadius: '8px',
                    border: '1px solid #E6E6FA',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 900 }}>{r.name}</div>
                    <div style={{ fontSize: '11px' }}>Host: {r.host_name} • {r.subject || 'General'}</div>
                  </div>
                  <NavLink to={`/rooms/${r.id}`} className="btn-accent" style={{ padding: '6px 10px', fontSize: '11px' }}>
                    <span>Join</span>
                    <ArrowRight size={12} color="#E6E6FA" />
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
