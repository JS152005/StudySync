import React, { useState } from 'react';
import { THEME } from '../../theme';
import { Plus, X } from 'lucide-react';

export interface FABAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'vermilion' | 'secondary';
}

export interface FloatingActionButtonProps {
  mainAction?: () => void;
  mainIcon?: React.ReactNode;
  mainLabel?: string;
  actions?: FABAction[];
  ariaLabel?: string;
  position?: 'bottom-right' | 'bottom-left';
  visible?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  mainAction,
  mainIcon,
  mainLabel = 'Quick action',
  actions,
  ariaLabel = 'Contextual quick actions',
  position = 'bottom-right',
  visible = true,
}) => {
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  const isSpeedDial = Array.isArray(actions) && actions.length > 0;

  const handleMainClick = () => {
    if (isSpeedDial) {
      setOpen(!open);
    } else if (mainAction) {
      mainAction();
    }
  };

  const posStyle: React.CSSProperties =
    position === 'bottom-right'
      ? { right: '28px', bottom: '28px' }
      : { left: '28px', bottom: '28px' };

  return (
    <div
      style={{
        position: 'fixed',
        ...posStyle,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: position === 'bottom-right' ? 'flex-end' : 'flex-start',
        gap: '12px',
        pointerEvents: 'none',
      }}
    >
      {/* Expanded Actions Stack */}
      {isSpeedDial && open && (
        <div
          className="orb-button-stack"
          style={{
            pointerEvents: 'auto',
            alignItems: position === 'bottom-right' ? 'flex-end' : 'flex-start',
            gap: '14px',
            marginBottom: '4px',
          }}
        >
          {actions.map((act) => {
            const isVermilion = act.variant === 'vermilion';
            const orbColorClass = isVermilion ? 'orb-vermilion' : 'orb-emerald';
            return (
              <div
                key={act.id}
                className="orb-wrapper"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* Blur-to-Focus Flyout Label */}
                <span className="orb-flyout-label">
                  {act.label}
                </span>

                {/* Glowing Orb Button */}
                <button
                  type="button"
                  onClick={() => {
                    act.onClick();
                    setOpen(false);
                  }}
                  aria-label={act.label}
                  className={`orb-action-btn ${orbColorClass}`}
                >
                  {act.icon}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Trigger Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={handleMainClick}
          aria-label={ariaLabel}
          aria-expanded={isSpeedDial ? open : undefined}
          title={mainLabel}
          className="orb-action-btn orb-emerald"
          style={{
            width: '54px',
            height: '54px',
            boxShadow: open
              ? 'inset 0 0 25px 4px rgba(0, 107, 79, 0.7), 0 0 35px 6px rgba(0, 107, 79, 0.5)'
              : 'inset 0 0 18px 2px rgba(0, 107, 79, 0.4), 0 6px 24px rgba(0, 107, 79, 0.35)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {isSpeedDial && open ? (
            <X size={24} color="#FFFFFF" strokeWidth={2.4} />
          ) : (
            mainIcon || <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
          )}
        </button>
      </div>

      <style>{`
        .fab-main-button:hover {
          transform: scale(1.08) translateY(-2px);
          background-color: var(--color-deep-forest-charcoal) !important;
        }
        .fab-main-button:active {
          transform: scale(0.95);
        }
        .fab-item-button:hover {
          transform: scale(1.1);
        }
        @media (max-width: 768px) {
          .fab-main-button {
            width: 48px !important;
            height: 48px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingActionButton;
