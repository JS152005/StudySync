import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { Mail, ArrowLeft, Check } from 'lucide-react';

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
        backgroundColor: '#F0F8FF',
        padding: '20px',
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
          border: '3px solid #E6E6FA',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#E6E6FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <Mail size={24} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Reset Password</h1>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Enter your email to receive a secure, single-use password reset link.
          </p>
        </div>

        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="alert-box" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} color="#E6E6FA" />
              <span style={{ fontSize: '13px' }}>{msg}</span>
            </div>
            <p style={{ fontSize: '12px', lineHeight: 1.5 }}>
              Please check your spam folder if you do not see the message within a few minutes.
            </p>
            <NavLink to="/login" className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>
              Back to Sign In
            </NavLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '6px' }}>
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

            <button type="submit" disabled={loading || !email} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              <span>{loading ? 'Sending Request...' : 'Send Reset Link'}</span>
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <NavLink to="/login" style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={14} color="#E6E6FA" />
                <span>Return to Sign In</span>
              </NavLink>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
