import React from 'react';
import { THEME } from '../../theme';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div
      className="card-secondary"
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        backgroundColor: '#F8FAFC',
        border: '1px dashed #CBD5E1',
        borderRadius: THEME.radius.card,
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0284C7',
          marginBottom: '2px',
        }}
      >
        {icon}
      </div>

      <div style={{ maxWidth: '420px' }}>
        <h3
          style={{
            fontSize: '16.5px',
            fontWeight: 700,
            color: THEME.textPrimary,
            letterSpacing: '-0.015em',
            marginBottom: '6px',
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: THEME.textSecondary, lineHeight: 1.5 }}>{description}</p>
      </div>

      {action && <div style={{ marginTop: '6px' }}>{action}</div>}
    </div>
  );
};

export default EmptyState;
