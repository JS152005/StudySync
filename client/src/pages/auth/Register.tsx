import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
        backgroundColor: '#F0F8FF',
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
            <Sparkles size={28} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900 }}>Create Student Account</h1>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Join thousands of engineering and medical students learning together.
          </p>
        </div>

        {error && (
          <div className="alert-box" style={{ borderColor: '#E6E6FA', fontSize: '13px' }}>
            [ERROR] {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                Password (min 8 chars) *
              </label>
              <input
                type="password"
                placeholder="Create strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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
              <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              required
            />
            <label htmlFor="terms" style={{ fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              I agree to the StudySync Terms of Service and Privacy Policy.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
          >
            <UserPlus size={16} color="#FFFFFF" />
            <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '13px', borderTop: '1px solid #E6E6FA', paddingTop: '16px' }}>
          Already have an account?{' '}
          <NavLink to="/login" style={{ textDecoration: 'underline' }}>
            Sign In
          </NavLink>
        </div>
      </div>
    </div>
  );
};
