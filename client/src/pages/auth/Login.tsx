import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { BiometricLoginButton } from '../../components/ui/BiometricLoginButton';
import { Eye, EyeOff, Sparkles, LogIn, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail('');
    setLoading(true);

    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Login failed.';
      setError(msg);
      if (msg.toLowerCase().includes('verify')) {
        setUnverifiedEmail(identifier.includes('@') ? identifier : '');
      }
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
        {/* Brand Header */}
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
            <Sparkles size={24} color="#0284C7" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Welcome to StudySync
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: '#64748B' }}>
            Learn together. Teach each other. Achieve more.
          </p>
        </div>

        {error && (
          <div className="alert-box-vermilion" style={{ fontSize: '13px' }}>
            <div>
              <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {error}
            </div>
            {error.toLowerCase().includes('verify') && (
              <NavLink
                to={`/verify-email?pending=true&email=${encodeURIComponent(unverifiedEmail || identifier)}`}
                style={{
                  color: THEME.vermilion,
                  fontWeight: 700,
                  fontSize: '12px',
                  marginTop: '6px',
                  display: 'inline-block',
                  textDecoration: 'underline',
                }}
              >
                Click here to verify your student email &rarr;
              </NavLink>
            )}
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
              <label style={{ fontSize: '12px', fontWeight: 700, color: THEME.deepForestCharcoal }}>
                Password *
              </label>
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
                style={{ paddingRight: '42px' }}
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
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} color={THEME.deepForestCharcoal} /> : <Eye size={16} color={THEME.warmStone} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <BiometricLoginButton
              disabled={!identifier || !password}
              loading={loading}
              label="Authenticate & Sign In"
              error={!!error}
            />
            <span style={{ fontSize: '11px', color: THEME.warmStone, fontWeight: 500 }}>
              Biometric token verification & password encryption enabled
            </span>
          </div>
        </form>

        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '16px',
            color: '#64748B',
          }}
        >
          Don't have a student account?{' '}
          <NavLink to="/register" style={{ textDecoration: 'underline', color: '#0284C7', fontWeight: 700 }}>
            Register Now
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default Login;
