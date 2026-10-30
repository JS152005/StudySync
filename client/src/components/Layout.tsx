import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { FloatingActionButton, FABAction } from './ui/FloatingActionButton';
import { triggerSparks } from './ui/SparkEffect';
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
  Sparkles,
  Search,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Contextual Floating Action Button actions (only on non-chat/non-live session routes)
  const isExcludedRoute =
    location.pathname.startsWith('/rooms/') || location.pathname.startsWith('/messages');

  const fabActions: FABAction[] = [
    {
      id: 'quick-room',
      label: 'Create Study Room',
      icon: <Video size={18} color="#FFFFFF" />,
      onClick: () => navigate('/rooms?action=create'),
      variant: 'primary',
    },
    {
      id: 'quick-focus',
      label: 'Start Focus Session',
      icon: <Timer size={18} color="#FFFFFF" />,
      onClick: () => navigate('/focus?action=create'),
      variant: 'primary',
    },
    {
      id: 'quick-syllabus',
      label: 'New Syllabus Board',
      icon: <ListTodo size={18} color="#FFFFFF" />,
      onClick: () => navigate('/syllabus?action=create'),
      variant: 'primary',
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Desktop Floating Left Navigation Rail */}
      <aside
        className="floating-nav-rail desktop-sidebar"
        aria-label="Main Navigation"
      >
        {/* Brand Header Emblem */}
        <NavLink
          to="/dashboard"
          className="floating-nav-emblem"
          aria-label="StudySync Dashboard"
          onClick={(e) => triggerSparks(e, 'azure', 12)}
        >
          <Sparkles size={22} color="#FFFFFF" strokeWidth={2.4} />
          <span className="floating-nav-tooltip">StudySync Hub</span>
        </NavLink>

        <div className="floating-nav-divider" />

        {/* Navigation Links with Active Tile & Tooltips */}
        <nav className="floating-nav-scroll">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `floating-nav-tile ${isActive ? 'active' : ''}`
                }
                aria-label={item.label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="floating-active-pip" />}
                    <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className="floating-nav-tooltip">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Actions: Profile & Logout */}
        <div className="floating-nav-footer">
          <NavLink
            to="/profile"
            className="floating-nav-tile"
            aria-label="User Profile"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#F1F5F9',
                border: '1.5px solid #0284C7',
                color: '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                position: 'relative',
              }}
            >
              {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
              <span
                className="live-pulse-dot"
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  border: `1.5px solid #FFFFFF`,
                }}
              />
            </div>
            <span className="floating-nav-tooltip">{user?.full_name || 'Profile'}</span>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="floating-nav-tile"
            aria-label="Sign Out"
            style={{ border: 'none', background: 'transparent' }}
          >
            <LogOut size={18} color="#64748B" />
            <span className="floating-nav-tooltip">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container with intentional offset ensuring zero overlap */}
      <div className="app-content-wrapper" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#F8FAFC' }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '58px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-secondary mobile-only-btn"
              style={{ padding: '7px 9px', display: 'none' }}
              aria-label="Toggle Navigation Drawer"
            >
              {mobileMenuOpen ? (
                <X size={18} color="#0F172A" />
              ) : (
                <Menu size={18} color="#0F172A" />
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0F172A',
                  letterSpacing: '-0.01em',
                }}
              >
                {user?.course ? `${user.course} Workspace` : 'StudySync Workspace'}
              </span>
              {user?.college && (
                <span
                  style={{
                    fontSize: '11.5px',
                    color: '#64748B',
                    fontWeight: 600,
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                  }}
                  className="hide-on-mobile"
                >
                  {user.college}
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions / Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.is_verified === 0 && (
              <NavLink to="/verify-email" className="badge badge-urgent" style={{ textDecoration: 'none' }}>
                Verify Email
              </NavLink>
            )}

            <button
              type="button"
              onClick={(e) => {
                triggerSparks(e, 'azure', 10);
                navigate('/rooms');
              }}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '12.5px',
                borderRadius: THEME.radius.pill,
                gap: '6px',
              }}
            >
              <Video size={14} color="#FFFFFF" />
              <span>Join Room</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer with Backdrop */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(6px)',
              zIndex: 998,
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '82%',
                maxWidth: '300px',
                backgroundColor: '#FFFFFF',
                borderRight: '1px solid #E2E8F0',
                zIndex: 999,
                padding: '20px 16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: THEME.shadow.modal,
                animation: `studysync-slide-in-right ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '14px',
                  borderBottom: '1px solid #E2E8F0',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#0284C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={16} color="#FFFFFF" />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    StudySync
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-ghost"
                  style={{ padding: '4px' }}
                  aria-label="Close navigation"
                >
                  <X size={18} color="#64748B" />
                </button>
              </div>

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
                      padding: '10px 14px',
                      borderRadius: THEME.radius.md,
                      fontSize: '13.5px',
                      fontWeight: isActive ? 700 : 500,
                      textDecoration: 'none',
                      backgroundColor: isActive ? '#0284C7' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#475569',
                      border: `1px solid ${isActive ? '#0284C7' : 'transparent'}`,
                      transition: 'all 0.15s ease',
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} color={isActive ? '#FFFFFF' : '#64748B'} />
                        <span style={{ color: isActive ? '#FFFFFF' : '#475569' }}>
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary"
                style={{ marginTop: 'auto', width: '100%', padding: '10px', gap: '8px' }}
              >
                <LogOut size={16} color="#64748B" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main
          style={{
            flex: 1,
            padding: '24px 28px',
            backgroundColor: '#F8FAFC',
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            animation: `studysync-fade-in ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
          }}
        >
          <Outlet />
        </main>

        {/* Global Contextual Floating Action Button */}
        {!isExcludedRoute && <FloatingActionButton actions={fabActions} mainLabel="Quick actions" />}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-only-btn {
            display: inline-flex !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
