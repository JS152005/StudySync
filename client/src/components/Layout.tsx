import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  UsersRound,
  Video,
  GraduationCap,
  ListTodo,
  Timer,
  CalendarDays,
  FolderOpen,
  UserCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/friends', label: 'Friends', icon: Users },
    { to: '/messages', label: 'Messages', icon: MessageSquare },
    { to: '/groups', label: 'Study Groups', icon: UsersRound },
    { to: '/rooms', label: 'Study Rooms', icon: Video },
    { to: '/teach', label: 'Teach & Learn', icon: GraduationCap },
    { to: '/syllabus', label: 'Syllabus Boards', icon: ListTodo },
    { to: '/focus', label: 'Focus Sessions', icon: Timer },
    { to: '/exams', label: 'Exam Planner', icon: CalendarDays },
    { to: '/resources', label: 'My Resources', icon: FolderOpen },
    { to: '/profile', label: 'Profile', icon: UserCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#FFFFFF' }}>
      {/* Desktop Left Navigation / Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#F0F8FF',
          borderRight: '2px solid #E6E6FA',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
        }}
        className="desktop-sidebar"
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '2px solid #E6E6FA',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#E6E6FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #E6E6FA',
            }}
          >
            <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#E6E6FA', letterSpacing: '-0.02em' }}>
              StudySync
            </div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#E6E6FA', textTransform: 'uppercase' }}>
              Student Workspace
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#E6E6FA' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#E6E6FA',
                  border: isActive ? '2px solid #E6E6FA' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} color={isActive ? '#FFFFFF' : '#E6E6FA'} strokeWidth={2.5} />
                    <span style={{ color: isActive ? '#FFFFFF' : '#E6E6FA' }}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer Card */}
        <div
          style={{
            padding: '16px',
            borderTop: '2px solid #E6E6FA',
            backgroundColor: '#FFFFFF',
            margin: '12px',
            borderRadius: '10px',
            border: '2px solid #E6E6FA',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#E6E6FA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '14px',
                border: '2px solid #E6E6FA',
              }}
            >
              {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 900,
                  color: '#E6E6FA',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {user?.full_name}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#E6E6FA' }}>
                @{user?.username}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: '100%', padding: '6px 12px', fontSize: '12px' }}
          >
            <LogOut size={14} color="#E6E6FA" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#FFFFFF' }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#FFFFFF',
            borderBottom: '2px solid #E6E6FA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-secondary mobile-only-btn"
              style={{ padding: '8px', display: 'none' }}
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={20} color="#E6E6FA" /> : <Menu size={20} color="#E6E6FA" />}
            </button>

            <span style={{ fontSize: '14px', fontWeight: 800, color: '#E6E6FA' }}>
              {user?.course ? `${user.course} Student Workspace` : 'StudySync Workspace'}
            </span>
          </div>

          {/* Quick Actions / Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.is_verified === 0 && (
              <NavLink to="/verify-email" className="badge" style={{ textDecoration: 'none' }}>
                Verify Email
              </NavLink>
            )}

            <NavLink to="/rooms" className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
              <Video size={16} color="#FFFFFF" />
              <span>Join Room</span>
            </NavLink>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              top: '64px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#F0F8FF',
              borderBottom: '3px solid #E6E6FA',
              zIndex: 999,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    backgroundColor: isActive ? '#E6E6FA' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#E6E6FA',
                    border: '2px solid #E6E6FA',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} color={isActive ? '#FFFFFF' : '#E6E6FA'} />
                      <span style={{ color: isActive ? '#FFFFFF' : '#E6E6FA' }}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
            <button
              onClick={handleLogout}
              className="btn-primary"
              style={{ marginTop: '16px', width: '100%', padding: '12px' }}
            >
              <LogOut size={18} color="#FFFFFF" />
              <span style={{ color: '#FFFFFF' }}>Sign Out</span>
            </button>
          </div>
        )}

        {/* Main Content View */}
        <main style={{ flex: 1, padding: '28px', backgroundColor: '#FFFFFF', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-only-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};
