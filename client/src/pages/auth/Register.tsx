import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { THEME } from '../../theme';
import { Button } from '../../components/ui/Button';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Sparkles, UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [course, setCourse] = useState('');
  const [college, setCollege] = useState('');
  const [academicYear, setAcademicYear] = useState('1st Year');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the terms of service and privacy policy.');
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: fullName,
        email,
        username,
        password,
        confirm_password: confirmPassword,
        course,
        college,
        academic_year: academicYear,
        terms_accepted: termsAccepted,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
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
        padding: '30px 20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          backgroundColor: THEME.warmIvory,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
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
              backgroundColor: THEME.emeraldGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: `1.5px solid ${THEME.deepForestCharcoal}`,
              boxShadow: THEME.shadow.subtle,
            }}
          >
            <Sparkles size={24} color={THEME.warmIvory} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Create Student Account
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: THEME.warmStone }}>
            Join thousands of engineering and medical students learning together.
          </p>
        </div>

        {error && (
          <div className="alert-box-vermilion" style={{ fontSize: '13px' }}>
            <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Alex Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                Email Address *
              </label>
              <input
                type="email"
                placeholder="student@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                Username or Student ID *
              </label>
              <input
                type="text"
                placeholder="e.g. 21CS104 or alex_sharma"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                Password (min 8 chars) *
              </label>
              <PasswordInput
                placeholder="Create strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                ariaLabel="Toggle password visibility"
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                Confirm Password *
              </label>
              <PasswordInput
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                ariaLabel="Toggle confirm password visibility"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                Course / Major
              </label>
              <input
                type="text"
                placeholder="e.g. B.Tech Computer Science"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                College / University
              </label>
              <input
                type="text"
                placeholder="e.g. National Institute of Tech"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
              Academic Year
            </label>
            <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
              <option value="Postgraduate / PhD">Postgraduate / PhD</option>
            </select>
          </div>

          {/* Polished Accessible Toggle for Terms */}
          <div
            style={{
              padding: '12px',
              borderRadius: THEME.radius.md,
              border: `1.5px solid ${termsAccepted ? THEME.emeraldGreen : THEME.deepForestCharcoal}`,
              backgroundColor: THEME.warmIvory,
              transition: `border-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
            }}
          >
            <ToggleSwitch
              id="terms-toggle"
              checked={termsAccepted}
              onChange={setTermsAccepted}
              label="I accept the Terms of Service & Privacy Policy"
              description="Required for academic identity verification, study rooms, and collaboration."
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            shape="pill"
            size="lg"
            disabled={!termsAccepted}
            loading={loading}
            leftIcon={<UserPlus size={16} color={THEME.warmIvory} />}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Complete Registration
          </Button>
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
          Already have an account?{' '}
          <NavLink to="/login" style={{ textDecoration: 'underline', color: THEME.emeraldGreen, fontWeight: 700 }}>
            Sign In
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default Register;
