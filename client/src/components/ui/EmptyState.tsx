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
        gap: '12px',
        backgroundColor: THEME.warmIvory,
        border: `1.5px dashed ${THEME.warmStone}`,
        borderRadius: THEME.radius.card,
      }}
    >
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: THEME.radius.full,
          backgroundColor: 'rgba(116, 111, 100, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: THEME.warmStone,
          marginBottom: '4px',
        }}
      >
        {icon}
      </div>

      <div style={{ maxWidth: '420px' }}>
        <h3
          style={{
            fontSize: '17px',
            fontWeight: 800,
            color: THEME.deepForestCharcoal,
            fontFamily: 'var(--font-serif)',
            marginBottom: '6px',
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: THEME.warmStone, lineHeight: 1.45 }}>{description}</p>
      </div>

      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  );
};

export default EmptyState;
