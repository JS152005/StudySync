import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MeetingProvider } from './context/MeetingContext';
import { ToastProvider } from './components/ui/ToastContext';
import { Layout } from './components/Layout';
import { FloatingMeetingDock } from './components/FloatingMeetingDock';
import { THEME } from './theme';

// Core Primary Pages
import { Dashboard } from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Rooms } from './pages/Rooms';
import { RoomSession } from './pages/RoomSession';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { VerifyEmail } from './pages/auth/VerifyEmail';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          color: '#0F172A',
          fontWeight: 700,
          fontSize: '16px',
        }}
      >
        Loading StudySync...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Guard (Redirect to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <MeetingProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* Core Application Routes inside Master Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/rooms/:id" element={<RoomSession />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />

                {/* Seamless Legacy Redirects to Primary Destinations */}
                <Route path="/friends" element={<Navigate to="/messages" replace />} />
                <Route path="/groups" element={<Navigate to="/messages" replace />} />
                <Route path="/groups/:id" element={<Navigate to="/messages" replace />} />
                <Route path="/community" element={<Navigate to="/dashboard" replace />} />
                <Route path="/teach" element={<Navigate to="/dashboard" replace />} />
                <Route path="/syllabus" element={<Navigate to="/dashboard" replace />} />
                <Route path="/focus" element={<Navigate to="/dashboard" replace />} />
                <Route path="/exams" element={<Navigate to="/dashboard" replace />} />
                <Route path="/resources" element={<Navigate to="/dashboard" replace />} />
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>

            {/* Persistent In-App Meeting Dock (Google Meet Floating Mini-Window) */}
            <FloatingMeetingDock />
          </MeetingProvider>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
