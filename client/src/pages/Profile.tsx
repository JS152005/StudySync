import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { SegmentedControl, SegmentOption } from '../components/ui/SegmentedControl';
import { useToast } from '../components/ui/ToastContext';
import { triggerSparks } from '../components/ui/SparkEffect';
import { Save, Check, Copy, User, ShieldCheck } from 'lucide-react';

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
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setCourse(user.course || '');
      setCollege(user.college || '');
      setAcademicYear(user.academic_year || '');
      setBio(user.bio || '');
      setAvailability(user.availability || 'available');
    }
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
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = (e: React.MouseEvent) => {
    if (!user?.student_id) return;
    navigator.clipboard.writeText(user.student_id);
    triggerSparks(e, 'azure', 8);
    setCopiedId(true);
    toast.success(`Copied Student ID: ${user.student_id}`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const availabilityOptions: SegmentOption<string>[] = [
    {
      value: 'available',
      label: 'Available for Study',
      icon: <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }} />,
    },
    {
      value: 'studying',
      label: 'In Study Session',
      icon: <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284C7' }} />,
    },
    {
      value: 'busy',
      label: 'Busy / In Class',
      icon: <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94A3B8' }} />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '780px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
          Student Identity & Profile
        </h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
          Your academic identity visible to peers when they find you by Student ID.
        </p>
      </div>

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: THEME.radius.control,
            padding: '10px 14px',
            color: '#065F46',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <Check size={16} color="#10B981" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Profile Form Card */}
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          borderRadius: THEME.radius.card,
          padding: '28px',
        }}
      >
        {/* Identity Showcase Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            paddingBottom: '20px',
            borderBottom: '1px solid #E2E8F0',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#0284C7',
              fontWeight: 800,
              border: '2px solid rgba(2, 132, 199, 0.3)',
              flexShrink: 0,
            }}
          >
            {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                {user?.full_name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <ShieldCheck size={13} color="#10B981" /> Verified
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>@{user?.username}</div>

            {/* Student ID Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>UNIQUE STUDENT ID:</span>
              <div
                onClick={handleCopyId}
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '13px',
                  color: '#0284C7',
                  backgroundColor: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  padding: '3px 10px',
                  borderRadius: THEME.radius.pill,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
                title="Click to copy Student ID"
              >
                <span>{user?.student_id}</span>
                {copiedId ? <Check size={12} color="#10B981" /> : <Copy size={12} color="#0284C7" />}
              </div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
              Course / Degree
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science & Engineering"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
              College / Institution
            </label>
            <input
              type="text"
              placeholder="e.g. Vel Tech Rangarajan Dr. Sagunthala R&D Institute"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
              Academic Year
            </label>
            <input
              type="text"
              placeholder="e.g. 3rd Year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Availability Status */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
            Study Availability Status
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
          <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#0F172A' }}>
            About / Study Focus
          </label>
          <textarea
            rows={3}
            placeholder="Tell fellow students what subjects you are studying or preparing for..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '13.5px',
              color: '#0F172A',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
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
    </div>
  );
};

export default Profile;
