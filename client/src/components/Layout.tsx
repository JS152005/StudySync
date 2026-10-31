import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeeting } from '../context/MeetingContext';
import { THEME } from '../theme';
import { triggerSparks } from './ui/SparkEffect';
import { useToast } from './ui/ToastContext';
import {
  LayoutDashboard,
  MessageSquare,
  Video,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  Copy,
  Check,
  Maximize2,
  ChevronDown,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const meeting = useMeeting();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleCopyStudentId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.student_id) return;
    navigator.clipboard.writeText(user.student_id);
    triggerSparks(e, 'azure', 8);
    setCopiedId(true);
    toast.success(`Copied Student ID: ${user.student_id}`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/messages', label: 'Chats', icon: MessageSquare },
    { to: '/rooms', label: 'Study Rooms', icon: Video },
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const inMeetingRoute = meeting.activeRoomId && location.pathname.startsWith(`/rooms/${meeting.activeRoomId}`);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Desktop Floating Icon Navigation Rail (Island Architecture) */}
      <aside
        className="floating-nav-rail desktop-sidebar"
        aria-label="Main Navigation"
      >
        {/* Brand Header Emblem */}
        <NavLink
          to="/dashboard"
          className="floating-nav-emblem-wrapper"
          aria-label="StudySync Dashboard"
          onClick={(e) => triggerSparks(e, 'azure', 12)}
        >
          <div className="floating-nav-emblem">
            <Sparkles size={20} color="#FFFFFF" strokeWidth={2.4} />
          </div>
          <span className="floating-nav-brand-text">StudySync</span>
        </NavLink>

        <div className="floating-nav-divider" />

        {/* Navigation Links with Active Pips & Smooth Expanded Labels */}
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
                    <span className="floating-nav-icon-wrapper">
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                    </span>
                    <span className="floating-nav-label">{item.label}</span>
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
            <span className="floating-nav-icon-wrapper">
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#F1F5F9',
                  border: '1.5px solid #0284C7',
                  color: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '12px',
                }}
              >
                {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
              </div>
            </span>
            <span className="floating-nav-label">{user?.full_name || 'Profile'}</span>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="floating-nav-tile"
            aria-label="Sign Out"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
            }}
          >
            <span className="floating-nav-icon-wrapper">
              <LogOut size={17} strokeWidth={2} />
            </span>
            <span className="floating-nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="app-content-wrapper">
        {/* Redesigned Minimalist Top Bar */}
        <header
          style={{
            height: '56px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* Left: StudySync Logo & Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="btn-ghost mobile-only-btn"
              style={{ padding: '6px', display: 'none' }}
              aria-label="Open navigation menu"
            >
              <Menu size={20} color="#0F172A" />
            </button>

            <NavLink
              to="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: '#0F172A',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                }}
              >
                <Sparkles size={16} color="#FFFFFF" />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#0F172A' }}>
                StudySync
              </span>
            </NavLink>
          </div>

          {/* Right: Meeting Status Indicator & Profile Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Compact Meeting Connection Indicator (Only shown when room is active in background) */}
            {meeting.activeRoomId && !inMeetingRoute && (
              <button
                type="button"
                onClick={meeting.restoreMeeting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: THEME.radius.pill,
                  padding: '4px 12px',
                  color: '#047857',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Return to active study room"
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 6px #10B981',
                  }}
                />
                <span>{meeting.roomData?.room?.name || 'Study Room'}</span>
                <span style={{ color: '#059669', opacity: 0.8 }}>• Return</span>
                <Maximize2 size={12} color="#047857" />
              </button>
            )}

            {/* Email Verification Pill if unverified */}
            {user?.is_verified === 0 && (
              <NavLink
                to={user?.email ? `/verify-email?email=${encodeURIComponent(user.email)}` : '/verify-email'}
                className="badge badge-urgent"
                style={{ textDecoration: 'none' }}
              >
                Verify Email
              </NavLink>
            )}

            {/* Profile Avatar & Dropdown Menu */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: THEME.radius.pill,
                  padding: '3px 8px 3px 3px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                aria-expanded={profileDropdownOpen}
                aria-label="User profile menu"
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '12px',
                  }}
                >
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
                </div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }} className="hide-on-mobile">
                  {user?.full_name?.split(' ')[0] || 'Student'}
                </span>
                <ChevronDown size={13} color="#64748B" />
              </button>

              {/* Profile Dropdown Popup */}
              {profileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '40px',
                    right: 0,
                    width: '240px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: THEME.radius.card,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                    zIndex: 100,
                    padding: '8px 0',
                    animation: 'studysync-slide-down 0.15s ease',
                  }}
                >
                  {/* User info & Student ID */}
                  <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      {user?.full_name || 'Student'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>
                      @{user?.username}
                    </div>

                    {user?.student_id && (
                      <div
                        onClick={handleCopyStudentId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          borderRadius: THEME.radius.pill,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0284C7',
                          fontFamily: 'monospace',
                        }}
                        title="Click to copy your Student ID"
                      >
                        <span>ID: {user.student_id}</span>
                        {copiedId ? <Check size={11} color="#10B981" /> : <Copy size={11} color="#0284C7" />}
                      </div>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div style={{ padding: '4px 0' }}>
                    <NavLink
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        color: '#334155',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <User size={14} color="#64748B" />
                      <span>My Profile</span>
                    </NavLink>

                    <NavLink
                      to="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        color: '#334155',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <Settings size={14} color="#64748B" />
                      <span>Settings</span>
                    </NavLink>
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />

                  {/* Sign Out */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      color: '#DC2626',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <LogOut size={14} color="#DC2626" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
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
                maxWidth: '280px',
                backgroundColor: '#FFFFFF',
                borderRight: '1px solid #E2E8F0',
                zIndex: 999,
                padding: '20px 16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: THEME.shadow.modal,
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
                  <Sparkles size={18} color="#0284C7" />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    StudySync
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: '#64748B',
                  }}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `mobile-nav-item ${isActive ? 'active' : ''}`
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: THEME.radius.md,
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#334155',
                    }}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    width: '100%',
                    borderRadius: THEME.radius.md,
                    border: 'none',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Outlet Workspace Content */}
        <main
          className="app-main-content"
          style={{
            flex: 1,
            padding: '20px 24px',
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Rail */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-bottom-tile ${isActive ? 'active' : ''}`
              }
              aria-label={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
