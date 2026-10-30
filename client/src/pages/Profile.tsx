import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { useToast } from '../components/ui/ToastContext';
import { Save, GraduationCap, BookOpen, Check, User, Sparkles, Copy } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

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
      toast.success('Student profile updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const availabilityOptions: SegmentOption<string>[] = [
    {
      value: 'available',
      label: 'Available for Study',
      icon: <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} />,
    },
    {
      value: 'studying',
      label: 'Deep Studying',
      icon: <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: THEME.vermilion }} />,
    },
    {
      value: 'busy',
      label: 'Busy / In Class',
      icon: <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: THEME.warmStone }} />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Student Identity & Profile
        </h1>
        <p style={{ fontSize: '13px', color: THEME.warmStone }}>
          Your public academic profile visible to peers and study groups on StudySync.
        </p>
      </div>

      {successMsg && (
        <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} color={THEME.emeraldGreen} />
          <span style={{ color: THEME.deepForestCharcoal }}>{successMsg}</span>
        </div>
      )}

      {/* Main Profile Form Card */}
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: THEME.radius.full,
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              color: '#0284C7',
              fontWeight: 800,
              border: '1.5px solid rgba(2, 132, 199, 0.3)',
              flexShrink: 0,
            }}
          >
            {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
          </div>

          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>@{user?.username}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>PUBLIC STUDENT ID:</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '12px',
                  color: '#0284C7',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  padding: '2px 8px',
                  borderRadius: THEME.radius.sharp,
                }}
              >
                {user?.student_id}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (user?.student_id) {
                    navigator.clipboard.writeText(user.student_id);
                    toast.success(`Student ID ${user.student_id} copied to clipboard!`);
                  }
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: THEME.radius.pill,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F1F5F9',
                  color: '#0F172A',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Copy size={11} color="#64748B" />
                <span>Copy</span>
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Course / Degree
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science & Engineering"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              College / University
            </label>
            <input
              type="text"
              placeholder="e.g. National Institute of Technology"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 700,
                display: 'block',
                marginBottom: '4px',
                color: THEME.deepForestCharcoal,
              }}
            >
              Academic Year
            </label>
            <input
              type="text"
              placeholder="e.g. 3rd Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
        </div>

        {/* Study Availability Segmented Control */}
        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              display: 'block',
              marginBottom: '6px',
              color: THEME.deepForestCharcoal,
            }}
          >
            Study Status & Peer Availability
          </label>
          <SegmentedControl
            options={availabilityOptions}
            value={availability}
            onChange={(val) => setAvailability(val)}
            variant="pill"
            size="md"
          />
        </div>

        <div>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              display: 'block',
              marginBottom: '4px',
              color: THEME.deepForestCharcoal,
            }}
          >
            Introduction & Study Goals
          </label>
          <textarea
            rows={3}
            placeholder="Tell peers what you are studying, topics you excel at, or what exams you are targeting..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            type="submit"
            variant="primary"
            shape="pill"
            loading={saving}
            leftIcon={<Save size={15} color="#FFFFFF" />}
          >
            Save Profile
          </Button>
        </div>
      </form>

      {/* Academic Specialties Summary */}
      <div
        className="card-secondary"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: THEME.radius.card,
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
          Academic Specialties (Teach & Learn)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <GraduationCap size={16} color="#0284C7" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Topics You Can Teach ({teachTopics.length})
              </span>
            </div>
            {teachTopics.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>No teaching topics added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {teachTopics.map((t) => (
                  <span key={t.id} className="badge">
                    {t.subject}: {t.topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <BookOpen size={16} color="#0EA5E9" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                Topics You Need Help With ({learnTopics.length})
              </span>
            </div>
            {learnTopics.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>No learning topics added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {learnTopics.map((t) => (
                  <span key={t.id} className="badge-outline" style={{ fontSize: '11px' }}>
                    {t.subject}: {t.topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
