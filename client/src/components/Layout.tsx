import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../theme';
import { FloatingActionButton, FABAction } from './ui/FloatingActionButton';
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
  Plus,
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
      icon: <Video size={18} color={THEME.warmIvory} />,
      onClick: () => navigate('/rooms?action=create'),
      variant: 'primary',
    },
    {
      id: 'quick-focus',
      label: 'Start Focus Session',
      icon: <Timer size={18} color={THEME.warmIvory} />,
      onClick: () => navigate('/focus?action=create'),
      variant: 'primary',
    },
    {
      id: 'quick-syllabus',
      label: 'New Syllabus Board',
      icon: <ListTodo size={18} color={THEME.warmIvory} />,
      onClick: () => navigate('/syllabus?action=create'),
      variant: 'primary',
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: THEME.warmIvory }}>
      {/* Desktop Left Navigation / Sidebar */}
      <aside
        style={{
          width: '264px',
          backgroundColor: THEME.warmIvory,
          borderRight: `1.5px solid ${THEME.deepForestCharcoal}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          boxShadow: THEME.shadow.subtle,
        }}
        className="desktop-sidebar"
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '20px 20px',
            borderBottom: `1.5px solid ${THEME.deepForestCharcoal}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: THEME.radius.md,
              backgroundColor: THEME.emeraldGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              boxShadow: THEME.shadow.subtle,
            }}
          >
            <Sparkles size={20} color={THEME.warmIvory} strokeWidth={2.5} />
          </div>
          <div>
            <div
              style={{
                fontSize: '19px',
                fontWeight: 800,
                color: THEME.deepForestCharcoal,
                fontFamily: 'var(--font-serif)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              StudySync
            </div>
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: THEME.warmStone,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: '2px',
              }}
            >
              Academic Workspace
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
                className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 12px',
                  borderRadius: THEME.radius.md,
                  fontSize: '13.5px',
                  fontWeight: isActive ? 700 : 600,
                  textDecoration: 'none',
                  backgroundColor: isActive ? THEME.emeraldGreen : 'transparent',
                  color: isActive ? THEME.warmIvory : THEME.deepForestCharcoal,
                  border: isActive ? `1.5px solid ${THEME.emeraldGreen}` : '1.5px solid transparent',
                  transition: `all ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
                  position: 'relative',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} color={isActive ? THEME.warmIvory : THEME.deepForestCharcoal} strokeWidth={2} />
                    <span style={{ color: isActive ? THEME.warmIvory : THEME.deepForestCharcoal }}>{item.label}</span>
                    {isActive && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          width: '6px',
                          height: '6px',
                          borderRadius: THEME.radius.full,
                          backgroundColor: THEME.warmIvory,
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer Card */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: `1.5px solid ${THEME.deepForestCharcoal}`,
            backgroundColor: THEME.warmIvory,
            margin: '12px',
            borderRadius: THEME.radius.card,
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            boxShadow: THEME.shadow.subtle,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: THEME.radius.full,
                backgroundColor: THEME.emeraldGreen,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.warmIvory,
                fontWeight: 800,
                fontSize: '13.5px',
                border: `1.5px solid ${THEME.deepForestCharcoal}`,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
              {/* Online Pulse Indicator */}
              <span
                className="live-pulse-dot"
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  border: `1.5px solid ${THEME.warmIvory}`,
                }}
              />
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.deepForestCharcoal,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {user?.full_name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: THEME.warmStone,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>@{user?.username}</span>
                <span>•</span>
                <span style={{ color: THEME.emeraldGreen }}>Active</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }}
          >
            <LogOut size={13} color={THEME.deepForestCharcoal} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: THEME.warmIvory }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '62px',
            backgroundColor: THEME.warmIvory,
            borderBottom: `1.5px solid ${THEME.deepForestCharcoal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            boxShadow: THEME.shadow.subtle,
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
                <X size={18} color={THEME.deepForestCharcoal} />
              ) : (
                <Menu size={18} color={THEME.deepForestCharcoal} />
              )}
            </button>

            <div>
              <span
                style={{
                  fontSize: '14.5px',
                  fontWeight: 700,
                  color: THEME.deepForestCharcoal,
                  letterSpacing: '-0.01em',
                }}
              >
                {user?.course ? `${user.course} Workspace` : 'StudySync Workspace'}
              </span>
              {user?.college && (
                <span
                  style={{
                    fontSize: '11px',
                    color: THEME.warmStone,
                    marginLeft: '8px',
                    fontWeight: 500,
                    display: 'inline-block',
                  }}
                  className="hide-on-mobile"
                >
                  ({user.college})
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

            <NavLink
              to="/rooms"
              className="btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: '12.5px',
                borderRadius: THEME.radius.pill,
              }}
            >
              <Video size={15} color={THEME.warmIvory} />
              <span>Join Room</span>
            </NavLink>
          </div>
        </header>

        {/* Mobile Navigation Drawer with Backdrop */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(38, 53, 47, 0.6)',
              zIndex: 998,
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '80%',
                maxWidth: '300px',
                backgroundColor: THEME.warmIvory,
                borderRight: `2px solid ${THEME.deepForestCharcoal}`,
                zIndex: 999,
                padding: '20px 16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
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
                  borderBottom: `1.5px solid ${THEME.deepForestCharcoal}`,
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-serif)' }}>
                  StudySync
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-ghost"
                  style={{ padding: '4px' }}
                  aria-label="Close navigation"
                >
                  <X size={18} color={THEME.deepForestCharcoal} />
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
                      padding: '11px 14px',
                      borderRadius: THEME.radius.md,
                      fontSize: '14px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      backgroundColor: isActive ? THEME.emeraldGreen : THEME.warmIvory,
                      color: isActive ? THEME.warmIvory : THEME.deepForestCharcoal,
                      border: `1.5px solid ${isActive ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} color={isActive ? THEME.warmIvory : THEME.deepForestCharcoal} />
                        <span style={{ color: isActive ? THEME.warmIvory : THEME.deepForestCharcoal }}>
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
                className="btn-primary"
                style={{ marginTop: 'auto', width: '100%', padding: '11px' }}
              >
                <LogOut size={16} color={THEME.warmIvory} />
                <span style={{ color: THEME.warmIvory }}>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main
          style={{
            flex: 1,
            padding: '28px',
            backgroundColor: THEME.warmIvory,
            maxWidth: '1400px',
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
        .nav-link:hover {
          background-color: rgba(38, 53, 47, 0.06) !important;
          color: var(--color-deep-forest-charcoal) !important;
        }
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
