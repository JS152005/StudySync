import React, { useState } from 'react';
import { useSearchParams, NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { KeyRound, Check } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Password reset token is missing from URL.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
          animation: `studysync-scale-in ${THEME.motion.durationNormal} ${THEME.motion.easeSpring}`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: THEME.radius.md,
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid rgba(2, 132, 199, 0.3)',
            }}
          >
            <KeyRound size={22} color="#0284C7" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
            Create New Password
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: '#64748B' }}>
            Choose a secure, memorable password for your account.
          </p>
        </div>

        {error && (
          <div className="alert-box-vermilion" style={{ fontSize: '13px' }}>
            <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {error}
          </div>
        )}

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
            <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} color={THEME.emeraldGreen} />
              <span style={{ color: THEME.deepForestCharcoal }}>Password successfully reset! You can now sign in.</span>
            </div>
            <Button
              variant="primary"
              shape="pill"
              size="lg"
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Proceed to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
                New Password (min 8 chars) *
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
                Confirm New Password *
              </label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              disabled={loading || !newPassword || !confirmPassword}
              loading={loading}
              style={{ width: '100%' }}
            >
              Reset Password
            </Button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <NavLink to="/login" style={{ fontSize: '13px', color: THEME.emeraldGreen }}>
                Cancel and Return to Sign In
              </NavLink>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
