import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import {
  Mail,
  ArrowLeft,
  Check,
  Send,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCw,
  Clock,
  Lock,
} from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Steps: 1 = Request OTP, 2 = Verify OTP, 3 = Set New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Timers: Resend cooldown (60s) & Expiration countdown (10m = 600s)
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState(600);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Expiration countdown effect
  useEffect(() => {
    if (step === 2 && expiresInSeconds > 0) {
      const timer = setInterval(() => {
        setExpiresInSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, expiresInSeconds]);

  // Resend cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Focus OTP input when entering step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [step]);

  // Format seconds to MM:SS
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // STEP 1: Request Password Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });
      setInfoMessage(res.message);
      setStep(2);
      setResendCooldown(60);
      setExpiresInSeconds(600); // 10 minutes
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendCooldown(60);
      setExpiresInSeconds(600);
      setOtp('');
      setInfoMessage('A fresh 6-digit verification code has been dispatched to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanOtp = otp.trim().replace(/[\s-]+/g, '');

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (expiresInSeconds <= 0) {
      setError('This verification code has expired. Please request a new code.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; reset_token: string }>('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
        }),
      });

      if (!res.reset_token) {
        throw new Error('Did not receive reset authorization token.');
      }

      setResetToken(res.reset_token);
      setInfoMessage(res.message);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Verification code is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Set New Password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
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
          maxWidth: '460px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.cardLg,
          boxShadow: THEME.shadow.lifted,
          animation: 'studysync-scale-in 240ms cubic-bezier(0.34, 1.35, 0.64, 1)',
        }}
      >
        {/* Step Indicator Header */}
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
            {step === 1 && <Mail size={22} color="#0284C7" />}
            {step === 2 && <Clock size={22} color="#0284C7" />}
            {step === 3 && <KeyRound size={22} color="#0284C7" />}
            {step === 4 && <ShieldCheck size={24} color="#10B981" />}
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
            {step === 1 && 'Reset Password'}
            {step === 2 && 'Verify Reset Code'}
            {step === 3 && 'Create New Password'}
            {step === 4 && 'Password Reset Complete'}
          </h1>

          <p style={{ fontSize: '13px', marginTop: '6px', color: '#64748B', lineHeight: 1.5 }}>
            {step === 1 && 'Enter your registered student email address to receive a 6-digit verification code.'}
            {step === 2 && `Enter the 6-digit code sent to ${email}.`}
            {step === 3 && 'Choose a strong password for your StudySync student account.'}
            {step === 4 && 'Your password has been successfully updated and secured.'}
          </p>

          {/* Stepper Progress Bar */}
          {step < 4 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '16px',
              }}
            >
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    height: '4px',
                    width: '32px',
                    borderRadius: '2px',
                    backgroundColor: step >= s ? '#0284C7' : '#E2E8F0',
                    transition: 'background-color 200ms ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Global Error Notice */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: THEME.radius.md,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#DC2626',
              fontSize: '12.5px',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* ================= STEP 1: ENTER EMAIL ================= */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                  color: '#0F172A',
                }}
              >
                Registered Email Address *
              </label>
              <input
                type="email"
                placeholder="student@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: THEME.radius.md,
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              disabled={!email || loading}
              loading={loading}
              leftIcon={<Send size={15} color="#FFFFFF" />}
              style={{ width: '100%' }}
            >
              Send 6-Digit Code
            </Button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <NavLink
                to="/login"
                style={{
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#0284C7',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} color="#0284C7" />
                <span>Return to Sign In</span>
              </NavLink>
            </div>
          </form>
        )}

        {/* ================= STEP 2: VERIFY 6-DIGIT OTP ================= */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                  6-Digit Verification Code (OTP) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11.5px',
                    color: '#0284C7',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Change Email
                </button>
              </div>

              {/* 6-Digit OTP Box with Paste Support */}
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(cleaned);
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: THEME.radius.md,
                  border: '2px solid #0284C7',
                  backgroundColor: '#F0F9FF',
                  fontSize: '24px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  color: '#0284C7',
                  outline: 'none',
                }}
              />
            </div>

            {/* Countdown Timer & Resend Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: THEME.radius.md,
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: expiresInSeconds <= 60 ? '#EF4444' : '#64748B' }}>
                <Clock size={14} />
                <span>
                  Expires in: <strong>{formatTimer(expiresInSeconds)}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? '#94A3B8' : '#0284C7',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCw size={12} />
                <span>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}</span>
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              disabled={otp.length !== 6 || loading}
              loading={loading}
              leftIcon={<Check size={16} color="#FFFFFF" />}
              style={{ width: '100%' }}
            >
              Verify Code
            </Button>
          </form>
        )}

        {/* ================= STEP 3: SET NEW PASSWORD ================= */}
        {step === 3 && (
          <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: THEME.radius.md,
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
                Confirm New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: THEME.radius.md,
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: THEME.radius.md,
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: newPassword.length >= 8 ? '#10B981' : '#64748B' }}>
                <Check size={13} color={newPassword.length >= 8 ? '#10B981' : '#94A3B8'} />
                <span>At least 8 characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: newPassword && newPassword === confirmPassword ? '#10B981' : '#64748B' }}>
                <Check size={13} color={newPassword && newPassword === confirmPassword ? '#10B981' : '#94A3B8'} />
                <span>Passwords match</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              disabled={newPassword.length < 8 || newPassword !== confirmPassword || loading}
              loading={loading}
              leftIcon={<Lock size={15} color="#FFFFFF" />}
              style={{ width: '100%' }}
            >
              Update Password
            </Button>
          </form>
        )}

        {/* ================= STEP 4: SUCCESS ================= */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: THEME.radius.md,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#065F46',
                fontSize: '13.5px',
                lineHeight: 1.5,
              }}
            >
              Your StudySync password has been updated. A confirmation notice was dispatched to your email. You can now sign in with your new credentials.
            </div>

            <Button
              type="button"
              variant="primary"
              shape="pill"
              size="lg"
              onClick={() => navigate('/login')}
              style={{ width: '100%' }}
            >
              Sign In Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
