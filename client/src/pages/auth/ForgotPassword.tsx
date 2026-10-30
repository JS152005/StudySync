import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Mail, ArrowLeft, Check, Send } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMsg(res.message);
      setSubmitted(true);
    } catch {
      setMsg('If an account exists with that email address, a password reset link has been sent.');
      setSubmitted(true);
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
            <Mail size={22} color="#0284C7" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
            Reset Password
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: '#64748B' }}>
            Enter your email to receive a secure, single-use password reset link.
          </p>
        </div>

        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} color={THEME.emeraldGreen} />
              <span style={{ fontSize: '13px', color: THEME.deepForestCharcoal }}>{msg}</span>
            </div>
            <p style={{ fontSize: '12px', lineHeight: 1.5, color: THEME.warmStone }}>
              Please check your spam folder if you do not see the message within a few minutes.
            </p>
            <NavLink to="/login" className="btn-secondary btn-pill" style={{ width: '100%', textAlign: 'center', justifyContent: 'center' }}>
              Back to Sign In
            </NavLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
                Registered Email Address *
              </label>
              <input
                type="email"
                placeholder="student@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              shape="pill"
              size="lg"
              disabled={!email}
              loading={loading}
              leftIcon={<Send size={15} color={THEME.warmIvory} />}
              style={{ width: '100%' }}
            >
              Send Reset Link
            </Button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <NavLink to="/login" style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: THEME.emeraldGreen, fontWeight: 600 }}>
                <ArrowLeft size={14} color={THEME.emeraldGreen} />
                <span>Return to Sign In</span>
              </NavLink>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
