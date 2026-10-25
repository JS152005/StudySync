import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { THEME } from '../theme';
import { Button } from '../components/ui/Button';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastContext';
import { KeyRound, Shield, Mail, Trash2, Check, Bell, Volume2, Sparkles } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Email Verification
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // Local Study Preferences
  const [soundCues, setSoundCues] = useState(true);
  const [focusReminders, setFocusReminders] = useState(true);
  const [peerInvites, setPeerInvites] = useState(true);

  // Delete Account Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      setPasswordMsg('Password successfully updated!');
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message);
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setEmailMsg('');
    try {
      await apiRequest('/auth/resend-verification', { method: 'POST' });
      setEmailMsg('Verification email sent! Please check your inbox.');
      toast.success('Verification link dispatched.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await apiRequest('/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password: deletePassword }),
      });
      toast.info('Account deactivated. Signing out.');
      await logout();
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Account & Study Preferences
        </h1>
        <p style={{ fontSize: '13px', color: THEME.warmStone }}>
          Manage your credentials, study alerts, verification status, and security settings.
        </p>
      </div>

      {/* Study Experience & Sound Preferences */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color={THEME.emeraldGreen} />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Study Experience & Motion Preferences
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <ToggleSwitch
            id="sound-cues-toggle"
            checked={soundCues}
            onChange={(val) => {
              setSoundCues(val);
              toast.info(val ? 'Timer sound cues enabled' : 'Timer sound cues muted');
            }}
            label="Focus Timer Chimes"
            description="Play subtle audio cues when Pomodoro study blocks and breaks transition."
          />

          <ToggleSwitch
            id="focus-reminders-toggle"
            checked={focusReminders}
            onChange={(val) => {
              setFocusReminders(val);
              toast.info(val ? 'Daily reminders enabled' : 'Daily reminders disabled');
            }}
            label="Daily Study Streak Alerts"
            description="Remind me of scheduled examination milestones and syllabus goals."
          />

          <ToggleSwitch
            id="peer-invites-toggle"
            checked={peerInvites}
            onChange={(val) => {
              setPeerInvites(val);
              toast.info(val ? 'Peer study invitations active' : 'Peer study invitations paused');
            }}
            label="Peer Teaching Invitations"
            description="Allow peers with matching syllabus doubts to send me study room invitations."
          />
        </div>
      </div>

      {/* Email Verification Box */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color={THEME.emeraldGreen} />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
                Email Verification Status
              </h2>
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px', color: THEME.deepForestCharcoal }}>
              Primary Address: <strong>{user?.email}</strong>
            </div>
          </div>

          <span className={user?.is_verified ? 'badge' : 'badge badge-urgent'}>
            {user?.is_verified ? 'Verified Student' : 'Unverified'}
          </span>
        </div>

        {user?.is_verified === 0 && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ fontSize: '12px', marginBottom: '10px', color: THEME.warmStone }}>
              Your account is unverified. Verification ensures uninterrupted access to study rooms and file sharing.
            </p>
            <Button
              variant="primary"
              size="sm"
              shape="pill"
              onClick={handleResendVerification}
              loading={resendingEmail}
            >
              Resend Verification Email
            </Button>
            {emailMsg && (
              <div style={{ fontSize: '12px', marginTop: '8px', color: THEME.emeraldGreen, fontWeight: 700 }}>
                {emailMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <form
        onSubmit={handlePasswordChange}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={18} color={THEME.emeraldGreen} />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Change Password
          </h2>
        </div>

        {passwordMsg && (
          <div className="alert-box-emerald" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} color={THEME.emeraldGreen} />
            <span style={{ color: THEME.deepForestCharcoal }}>{passwordMsg}</span>
          </div>
        )}

        {passwordError && (
          <div className="alert-box-vermilion">
            <span style={{ color: THEME.vermilion, fontWeight: 700 }}>[ERROR]</span> {passwordError}
          </div>
        )}

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
            Current Password *
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
            New Password (min 8 chars) *
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
            Confirm New Password *
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <Button
            type="submit"
            variant="primary"
            shape="pill"
            loading={savingPassword}
          >
            Update Password
          </Button>
        </div>
      </form>

      {/* Danger Zone: Deactivate Account */}
      <div
        className="card-secondary"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          border: `1.5px solid ${THEME.vermilion}`,
          backgroundColor: THEME.warmIvory,
          borderRadius: THEME.radius.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color={THEME.vermilion} />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Danger Zone: Account Deactivation
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: THEME.warmStone }}>
          Deactivating your account will invalidate your active study sessions and hide your profile from peers.
        </p>

        <div>
          <Button
            variant="vermilion"
            size="sm"
            shape="pill"
            onClick={() => setShowDeleteModal(true)}
            leftIcon={<Trash2 size={14} color={THEME.warmIvory} />}
          >
            Deactivate Account
          </Button>
        </div>
      </div>

      {/* Accessible Deactivate Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Account Deactivation"
        description="Please confirm by entering your current password. This will immediately log you out."
      >
        <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
              Current Password *
            </label>
            <input
              type="password"
              placeholder="Enter current password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="vermilion" loading={deleting}>
              Confirm Deactivation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;
