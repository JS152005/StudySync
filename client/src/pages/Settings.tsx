import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { THEME } from '../theme';
import { KeyRound, Shield, Mail, Trash2, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  // Delete Account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message);
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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password: deletePassword }),
      });
      alert('Account deactivated. Signing out.');
      await logout();
      navigate('/login');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
          Account & Security Settings
        </h1>
        <p style={{ fontSize: '13px', color: THEME.warmStone }}>
          Manage your credentials, verification state, and privacy settings.
        </p>
      </div>

      {/* Email Verification Box */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: `1.5px solid ${THEME.deepForestCharcoal}`, backgroundColor: THEME.warmIvory }}>
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
            <p style={{ fontSize: '12px', marginBottom: '8px', color: THEME.warmStone }}>
              Your account is unverified. Verification ensures uninterrupted access to study rooms and file sharing.
            </p>
            <button
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
            </button>
            {emailMsg && <div style={{ fontSize: '12px', marginTop: '6px', color: THEME.emeraldGreen, fontWeight: 700 }}>{emailMsg}</div>}
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
          <button type="submit" disabled={savingPassword} className="btn-primary">
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* Deactivate Account */}
      <div
        className="card-secondary"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: `1.5px solid ${THEME.vermilion}`,
          backgroundColor: THEME.warmIvory,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color={THEME.vermilion} />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: THEME.deepForestCharcoal }}>
            Danger Zone: Account Deactivation
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: THEME.warmStone }}>
          Deactivating your account will invalidate your active sessions and hide your profile from peers.
        </p>

        <div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-vermilion"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <Trash2 size={14} color={THEME.warmIvory} />
            <span>Deactivate Account</span>
          </button>
        </div>
      </div>

      {/* Deactivate Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '14px', color: THEME.deepForestCharcoal }}>
              Confirm Account Deactivation
            </h2>
            <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: THEME.warmStone }}>
                Please confirm by entering your current password. This will immediately log you out.
              </p>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: THEME.deepForestCharcoal }}>
                  Password *
                </label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-vermilion">
                  Confirm Deactivate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
