import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../theme';
import { Eye, EyeOff, Sparkles, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
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
        backgroundColor: THEME.warmIvory,
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
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          borderRadius: '8px',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              backgroundColor: THEME.emeraldGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
            }}
          >
            <Sparkles size={24} color={THEME.warmIvory} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Welcome to StudySync
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: THEME.warmStone }}>
            Learn together. Teach each other. Achieve more.
          </p>
        </div>

        {error && (
          <div className="alert-box-vermilion" style={{ fontSize: '13px' }}>
            <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: THEME.deepForestCharcoal }}>
              Email or Username / Student ID *
            </label>
            <input
              type="text"
              placeholder="e.g. student@college.edu or student_id"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>Password *</label>
              <NavLink to="/forgot-password" style={{ fontSize: '12px', color: THEME.emeraldGreen }}>
                Forgot Password?
              </NavLink>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                }}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} color={THEME.deepForestCharcoal} /> : <Eye size={16} color={THEME.warmStone} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !identifier || !password}
            className="btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: '6px' }}
          >
            <LogIn size={16} color={THEME.warmIvory} />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            borderTop: `1px solid ${THEME.warmStone}`,
            paddingTop: '16px',
            color: THEME.warmStone,
          }}
        >
          Don't have a student account?{' '}
          <NavLink to="/register" style={{ textDecoration: 'underline', color: THEME.emeraldGreen, fontWeight: 700 }}>
            Register Now
          </NavLink>
        </div>
      </div>
    </div>
  );
};
