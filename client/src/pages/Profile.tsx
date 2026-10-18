import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { UserCheck, Save, GraduationCap, BookOpen, ShieldCheck, Check } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [course, setCourse] = useState(user?.course || '');
  const [college, setCollege] = useState(user?.college || '');
  const [academicYear, setAcademicYear] = useState(user?.academic_year || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [availability, setAvailability] = useState(user?.availability || 'available');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Teach & Learn Topics
  const [teachTopics, setTeachTopics] = useState<any[]>([]);
  const [learnTopics, setLearnTopics] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setCourse(user.course || '');
      setCollege(user.college || '');
      setAcademicYear(user.academic_year || '');
      setBio(user.bio || '');
      setAvailability(user.availability || 'available');
    }

    apiRequest<{ teachTopics: any[]; learnTopics: any[] }>('/teach/topics')
      .then((res) => {
        setTeachTopics(res.teachTopics);
        setLearnTopics(res.learnTopics);
      })
      .catch(console.error);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          course,
          college,
          academic_year: academicYear,
          bio,
          availability,
        }),
      });
      await refreshUser();
      setSuccessMsg('Profile saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 900 }}>Student Identity & Profile</h1>
        <p style={{ fontSize: '13px' }}>Your public academic profile visible to peers and study groups on StudySync.</p>
      </div>

      {successMsg && (
        <div className="alert-box" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} color="#E6E6FA" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Profile Form Card */}
      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#E6E6FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#FFFFFF',
              fontWeight: 900,
              border: '2px solid #E6E6FA',
            }}
          >
            {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
          </div>

          <div>
            <div style={{ fontSize: '18px', fontWeight: 900 }}>{user?.full_name}</div>
            <div style={{ fontSize: '13px' }}>@{user?.username} (Student ID)</div>
            <div style={{ fontSize: '12px' }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Course / Degree</label>
            <input
              type="text"
              placeholder="e.g. Computer Science & Engineering"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>College / University</label>
            <input
              type="text"
              placeholder="e.g. National Institute of Technology"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Academic Year</label>
            <input
              type="text"
              placeholder="e.g. 3rd Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Study Status / Availability</label>
          <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="available">Available for Peer Study</option>
            <option value="studying">Currently Deep Studying</option>
            <option value="busy">Busy / In Class</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Introduction & Study Goals</label>
          <textarea
            rows={3}
            placeholder="Tell peers what you are studying, topics you excel at, or what exams you are targeting..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #E6E6FA' }}>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} color="#FFFFFF" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>

      {/* Topics Summary */}
      <div className="card-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 900 }}>Academic Specialties (Teach & Learn)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <GraduationCap size={16} color="#E6E6FA" />
              <span style={{ fontSize: '13px', fontWeight: 800 }}>Topics You Can Teach ({teachTopics.length})</span>
            </div>
            {teachTopics.length === 0 ? (
              <div style={{ fontSize: '12px' }}>No teaching topics added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {teachTopics.map((t) => (
                  <span key={t.id} className="badge">{t.subject}: {t.topic}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <BookOpen size={16} color="#E6E6FA" />
              <span style={{ fontSize: '13px', fontWeight: 800 }}>Topics You Need Help With ({learnTopics.length})</span>
            </div>
            {learnTopics.length === 0 ? (
              <div style={{ fontSize: '12px' }}>No learning topics added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {learnTopics.map((t) => (
                  <span key={t.id} className="badge-outline">{t.subject}: {t.topic}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
