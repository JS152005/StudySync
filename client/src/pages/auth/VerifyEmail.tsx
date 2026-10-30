import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Mail, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const isPending = searchParams.get('pending') === 'true';

  const navigate = useNavigate();

  const [inputToken, setInputToken] = useState(tokenFromUrl);
  const [targetEmail, setTargetEmail] = useState(emailParam);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>(
    tokenFromUrl ? 'verifying' : 'idle'
  );
  const [message, setMessage] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const verifyWithToken = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;
    setStatus('verifying');
    setMessage('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tokenToVerify.trim() }),
      });
      setStatus('success');
      setMessage(res.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Verification link is invalid or has expired.');
    }
  };

  useEffect(() => {
    if (tokenFromUrl) {
      verifyWithToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingToken(true);
    await verifyWithToken(inputToken);
    setSubmittingToken(false);
  };

  const handleResend = async () => {
    if (!targetEmail.trim()) {
      setResendStatus('Please specify an email address to resend the verification link.');
      return;
    }
    setResending(true);
    setResendStatus('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail.trim() }),
      });
      setResendStatus(res.message);
    } catch (err: any) {
      setResendStatus(err.message || 'Failed to resend verification email.');
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
        backgroundColor: '#F8FAFC',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
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
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(2, 132, 199, 0.3)',
          }}
        >
          <Mail size={26} color="#0284C7" />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
          {status === 'success' ? 'Email Verified!' : 'Verify Student Email'}
        </h1>

        {status === 'verifying' && (
          <p style={{ fontSize: '14px', color: THEME.deepForestCharcoal }}>
            Verifying your student email token...
          </p>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color={THEME.emeraldGreen} />
              <span style={{ color: THEME.deepForestCharcoal }}>{message}</span>
            </div>
            <p style={{ fontSize: '13px', color: THEME.warmStone }}>
              Your account is now activated. Log in to start collaborating with peers and study rooms.
            </p>
            <NavLink to="/login" className="btn-primary btn-pill" style={{ width: '100%', justifyContent: 'center' }}>
              <span>Proceed to Login</span>
              <ArrowRight size={14} color={THEME.warmIvory} />
            </NavLink>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div className="alert-box-vermilion">
              <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {message}
            </div>
            <p style={{ fontSize: '13px', color: THEME.warmStone }}>
              You can enter your token manually below or request a fresh verification link.
            </p>
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => setStatus('idle')}
              style={{ width: '100%' }}
            >
              Try Manual Entry / Resend
            </Button>
          </div>
        )}

        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
            <p style={{ fontSize: '13px', color: THEME.warmStone, lineHeight: 1.5 }}>
              {isPending
                ? `We've sent an activation link to ${targetEmail || 'your email'}. Check your inbox and click the link or paste the token code below.`
                : 'Click the link sent to your registered student email or paste your verification code below to activate your account.'}
            </p>

            {/* Manual Token Verification Form */}
            <form onSubmit={handleManualVerify} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={14} color={THEME.deepForestCharcoal} />
                <span>Verification Token</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Paste 64-character token"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: THEME.radius.control,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    backgroundColor: THEME.warmIvory,
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: THEME.deepForestCharcoal,
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  shape="pill"
                  loading={submittingToken}
                  disabled={!inputToken.trim()}
                >
                  Verify
                </Button>
              </div>
            </form>

            <div style={{ height: '1px', backgroundColor: THEME.warmStone, opacity: 0.3, width: '100%' }} />

            {/* Resend Link Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                Didn't receive the email?
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="Your student email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: THEME.radius.control,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    backgroundColor: THEME.warmIvory,
                    fontSize: '13px',
                    color: THEME.deepForestCharcoal,
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={handleResend}
                  loading={resending}
                  leftIcon={<RefreshCw size={13} color={THEME.deepForestCharcoal} />}
                >
                  Resend
                </Button>
              </div>
              {resendStatus && (
                <div className="alert-box" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {resendStatus}
                </div>
              )}
            </div>

            <div style={{ marginTop: '8px' }}>
              <NavLink to="/login" style={{ fontSize: '13px', fontWeight: 700, color: THEME.emeraldGreen, textDecoration: 'none' }}>
                Return to Login
              </NavLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
