import React from 'react';
import { THEME } from '../../theme';
import { Plus, ArrowUpRight, Check, Sparkles } from 'lucide-react';

export interface OrbActionItem {
  id: string;
  label: string;
  variant: 'emerald' | 'vermilion' | 'charcoal' | 'stone';
  icon: React.ReactNode;
  onClick: () => void;
}

export interface OrbActionStackProps {
  items?: OrbActionItem[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export const OrbActionStack: React.FC<OrbActionStackProps> = ({
  items,
  orientation = 'vertical',
  className = '',
}) => {
  // Default items if none provided
  const defaultItems: OrbActionItem[] = [
    {
      id: 'create',
      label: 'Create Room',
      variant: 'emerald',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      ),
      onClick: () => console.log('Create action clicked'),
    },
    {
      id: 'export',
      label: 'Share Session',
      variant: 'stone',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 17 L17 7 M17 7 L9 7 M17 7 L17 15" />
        </svg>
      ),
      onClick: () => console.log('Share action clicked'),
    },
    {
      id: 'confirm',
      label: 'Confirm Focus',
      variant: 'vermilion',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 13 L10 17.5 L19 7" />
        </svg>
      ),
      onClick: () => console.log('Confirm action clicked'),
    },
  ];

  const activeItems = items || defaultItems;

  return (
    <div
      className={`orb-button-stack ${className}`.trim()}
      style={{
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        gap: orientation === 'horizontal' ? '2.5rem' : '1.8rem',
        padding: '1.2rem',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {activeItems.map((item) => {
        let colorClass = 'orb-emerald';
        if (item.variant === 'vermilion') colorClass = 'orb-vermilion';
        else if (item.variant === 'charcoal') colorClass = 'orb-charcoal';
        else if (item.variant === 'stone') colorClass = 'orb-stone';

        return (
          <div key={item.id} className="orb-wrapper">
            <button
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              className={`orb-action-btn ${colorClass}`}
            >
              {item.icon}
            </button>
            <span
              className="orb-flyout-label"
              style={{
                [orientation === 'horizontal' ? 'top' : 'right']: '100%',
                [orientation === 'horizontal' ? 'right' : 'marginRight']: orientation === 'horizontal' ? 'auto' : '-4px',
                [orientation === 'horizontal' ? 'marginTop' : 'marginTop']: orientation === 'horizontal' ? '12px' : '0',
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default OrbActionStack;
