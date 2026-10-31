import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Mail, ArrowRight, RefreshCw, KeyRound, Lock, AlertCircle } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';
  const isPending = searchParams.get('pending') === 'true';

  const navigate = useNavigate();

  // Target email: lock from query param, or fallback to pending registration in sessionStorage
  const [targetEmail] = useState<string>(() => {
    return emailParam.trim() || sessionStorage.getItem('studysync_pending_email') || '';
  });

  // 6-digit OTP states
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>(
    tokenFromUrl ? 'verifying' : 'idle'
  );
  const [message, setMessage] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);

  // Sync token from URL if provided (e.g. clicking link in verification email)
  const verifyWithCode = async (codeToVerify: string, emailToUse: string = targetEmail) => {
    const cleaned = codeToVerify.replace(/[\s-]+/g, '').trim();
    if (!cleaned) return;

    setStatus('verifying');
    setMessage('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          token: cleaned,
          email: emailToUse.trim(),
        }),
      });
      setStatus('success');
      setMessage(res.message || 'Email verified successfully!');
      try {
        sessionStorage.removeItem('studysync_pending_email');
      } catch {
        // ignore
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Verification code is invalid or has expired.');
    }
  };

  useEffect(() => {
    if (tokenFromUrl) {
      const cleaned = tokenFromUrl.replace(/[\s-]+/g, '').trim();
      if (cleaned.length === 6 && /^\d+$/.test(cleaned)) {
        setOtp(cleaned.split(''));
      }
      verifyWithCode(cleaned, targetEmail);
    } else {
      // Auto-focus first OTP input box on initial mount
      inputRefs.current[0]?.focus();
    }
  }, [tokenFromUrl]);

  // Handle single digit typing
  const handleDigitChange = (index: number, val: string) => {
    const numericChars = val.replace(/\D/g, '');
    if (!numericChars) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    const digit = numericChars.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance focus to next digit box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Keyboard navigation & Backspace handling
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle pasting full 6-digit OTP code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length > 0) {
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);

      const targetFocus = Math.min(digits.length, 5);
      inputRefs.current[targetFocus]?.focus();

      // If user pasted a complete 6-digit OTP, automatically trigger verification
      if (digits.length === 6) {
        setSubmittingToken(true);
        verifyWithCode(digits.join(''), targetEmail).finally(() => {
          setSubmittingToken(false);
        });
      }
    }
  };

  // Submit entered 6-digit OTP
  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length < 6) return;

    setSubmittingToken(true);
    await verifyWithCode(fullOtp, targetEmail);
    setSubmittingToken(false);
  };

  // Resend 6-digit OTP to the non-editable target email
  const handleResend = async () => {
    if (!targetEmail.trim()) {
      setResendStatus('No target email address available to send OTP.');
      setResendSuccess(false);
      return;
    }

    setResending(true);
    setResendStatus('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail.trim() }),
      });
      setResendStatus(res.message || 'A fresh 6-digit OTP has been sent to your student email.');
      setResendSuccess(true);
      // Clear OTP inputs and focus the first one
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setResendStatus(err.message || 'Failed to resend verification code.');
      setResendSuccess(false);
    } finally {
      setResending(false);
    }
  };

  const isOtpComplete = otp.join('').length === 6;

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
          gap: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
          animation: `studysync-scale-in ${THEME.motion.durationNormal} ${THEME.motion.easeSpring}`,
        }}
      >
        {/* Email Icon Header */}
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

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          {status === 'success' ? 'Email Verified!' : 'Verify Student Email'}
        </h1>

        {/* VERIFYING STATE */}
        {status === 'verifying' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid #E2E8F0',
                borderTopColor: '#0284C7',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Verifying your 6-digit OTP code...
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: THEME.radius.control,
                textAlign: 'left',
              }}
            >
              <CheckCircle size={20} color="#10B981" style={{ flexShrink: 0 }} />
              <span style={{ color: '#065F46', fontSize: '13px', fontWeight: 600 }}>{message}</span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              Your account is officially activated. Log in to start collaborating in live study rooms,
              sharing notes, and connecting with peers.
            </p>
            <NavLink
              to="/login"
              className="btn-primary btn-pill"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              <span>Proceed to Login</span>
              <ArrowRight size={14} color="#FFFFFF" />
            </NavLink>
          </div>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: THEME.radius.control,
                textAlign: 'left',
              }}
            >
              <AlertCircle size={20} color="#F43F5E" style={{ flexShrink: 0 }} />
              <span style={{ color: '#9F1239', fontSize: '13px', fontWeight: 600 }}>{message}</span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              The OTP code entered may be incorrect or expired. You can try re-entering the code or request a fresh OTP.
            </p>
            <Button
              variant="secondary"
              shape="pill"
              onClick={() => {
                setStatus('idle');
                setOtp(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 50);
              }}
              style={{ width: '100%' }}
            >
              Re-enter 6-Digit OTP
            </Button>
          </div>
        )}

        {/* IDLE / OTP ENTRY STATE */}
        {status === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: 0 }}>
              {targetEmail ? (
                <>
                  We've sent a 6-digit verification code to{' '}
                  <strong style={{ color: '#0F172A', wordBreak: 'break-all' }}>{targetEmail}</strong>.
                  Check your inbox and enter the OTP below to activate your account.
                </>
              ) : (
                'Enter the 6-digit verification code sent to your registered student email address.'
              )}
            </p>

            {/* 6-Digit OTP Input Form */}
            <form onSubmit={handleManualVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <KeyRound size={14} color="#0284C7" />
                  <span>Enter 6-Digit OTP</span>
                </label>
                {otp.some(d => d !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtp(['', '', '', '', '', '']);
                      inputRefs.current[0]?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* 6 Distinct OTP Boxes with Middle Separator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                }}
              >
                {otp.map((digit, idx) => (
                  <React.Fragment key={idx}>
                    {idx === 3 && (
                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#94A3B8',
                          userSelect: 'none',
                          padding: '0 2px',
                        }}
                      >
                        –
                      </span>
                    )}
                    <input
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      onFocus={(e) => {
                        setFocusedIndex(idx);
                        e.target.select();
                      }}
                      onBlur={() => setFocusedIndex(null)}
                      style={{
                        width: '46px',
                        height: '52px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        border: focusedIndex === idx ? '2px solid #0284C7' : '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        boxShadow:
                          focusedIndex === idx
                            ? '0 0 0 3px rgba(2, 132, 199, 0.15)'
                            : '0 1px 2px rgba(0, 0, 0, 0.05)',
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                    />
                  </React.Fragment>
                ))}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                shape="pill"
                loading={submittingToken}
                disabled={!isOtpComplete || submittingToken}
                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
              >
                <span>Verify OTP</span>
                <ArrowRight size={14} color="#FFFFFF" />
              </Button>
            </form>

            <div style={{ height: '1px', backgroundColor: '#E2E8F0', width: '100%' }} />

            {/* Non-Editable Email & Resend Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                  Didn't receive the email?
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Email cannot be edited while verifying OTP"
                >
                  <Lock size={11} color="#64748B" />
                  Locked for OTP
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                {/* Strictly Non-Editable Email Input */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type="email"
                    value={targetEmail}
                    readOnly
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                    title="Student email cannot be edited during OTP verification"
                    placeholder="Student email"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: THEME.radius.control,
                      border: '1.5px solid #E2E8F0',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      outline: 'none',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  />
                  <Lock
                    size={13}
                    color="#94A3B8"
                    style={{
                      position: 'absolute',
                      left: '11px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={handleResend}
                  loading={resending}
                  disabled={!targetEmail.trim() || resending}
                  leftIcon={<RefreshCw size={13} color={THEME.deepForestCharcoal} />}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Resend
                </Button>
              </div>

              {resendStatus && (
                <div
                  style={{
                    fontSize: '12px',
                    marginTop: '2px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: resendSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    color: resendSuccess ? '#065F46' : '#9F1239',
                    border: resendSuccess ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {resendSuccess ? <CheckCircle size={14} color="#10B981" /> : <AlertCircle size={14} color="#F43F5E" />}
                  <span>{resendStatus}</span>
                </div>
              )}
            </div>

            {/* Back links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <NavLink
                to="/login"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0284C7',
                  textDecoration: 'none',
                }}
              >
                Return to Login
              </NavLink>

              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                Entered wrong email?{' '}
                <NavLink
                  to="/register"
                  style={{
                    color: '#64748B',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Register again
                </NavLink>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
