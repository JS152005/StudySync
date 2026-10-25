import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Mail, ArrowRight, RefreshCw } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  useEffect(() => {
    if (token) {
      apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
        .then((res) => {
          setStatus('success');
          setMessage(res.message);
          refreshUser();
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.message || 'Verification link is invalid or has expired.');
        });
    }
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendStatus('');
    try {
      const res = await apiRequest('/auth/resend-verification', { method: 'POST' });
      setResendStatus(res.message);
    } catch (err: any) {
      setResendStatus(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: THEME.warmIvory,
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
          animation: `studysync-scale-in ${THEME.motion.durationNormal} ${THEME.motion.easeSpring}`,
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: THEME.radius.md,
            backgroundColor: THEME.emeraldGreen,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            boxShadow: THEME.shadow.subtle,
          }}
        >
          <Mail size={26} color={THEME.warmIvory} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Email Verification
        </h1>

        {status === 'verifying' && (
          <p style={{ fontSize: '14px', color: THEME.deepForestCharcoal }}>Verifying your student email address...</p>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color={THEME.emeraldGreen} />
              <span style={{ color: THEME.deepForestCharcoal }}>{message}</span>
            </div>
            <NavLink to="/dashboard" className="btn-primary btn-pill" style={{ width: '100%', justifyContent: 'center' }}>
              <span>Enter StudySync Workspace</span>
              <ArrowRight size={14} color={THEME.warmIvory} />
            </NavLink>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <div className="alert-box-vermilion">
              <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[STATUS]</span> {message}
            </div>
            {user ? (
              <Button
                variant="primary"
                shape="pill"
                onClick={handleResend}
                loading={resending}
                style={{ width: '100%' }}
              >
                Request New Verification Link
              </Button>
            ) : (
              <NavLink to="/login" className="btn-secondary btn-pill" style={{ width: '100%', justifyContent: 'center' }}>
                Return to Login
              </NavLink>
            )}
          </div>
        )}

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <p style={{ fontSize: '13px', color: THEME.warmStone }}>
              We sent a verification link to your registered email address. Click the link in your email to verify your student account.
            </p>
            {user && (
              <Button
                variant="secondary"
                shape="pill"
                onClick={handleResend}
                loading={resending}
                leftIcon={<RefreshCw size={14} color={THEME.deepForestCharcoal} />}
                style={{ width: '100%' }}
              >
                Resend Verification Email
              </Button>
            )}
            {resendStatus && <div className="alert-box" style={{ fontSize: '12px' }}>{resendStatus}</div>}
            <NavLink to="/dashboard" className="btn-primary btn-pill" style={{ width: '100%', justifyContent: 'center' }}>
              Back to Dashboard
            </NavLink>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
