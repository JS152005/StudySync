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
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: position === 'bottom-right' ? 'flex-end' : 'flex-start',
            pointerEvents: 'auto',
            animation: `studysync-slide-up ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
          }}
        >
          {actions.map((act) => {
            const isVermilion = act.variant === 'vermilion';
            return (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexDirection: position === 'bottom-right' ? 'row' : 'row-reverse',
                }}
              >
                {/* Pill Tooltip/Label */}
                <span
                  style={{
                    backgroundColor: THEME.warmIvory,
                    color: THEME.deepForestCharcoal,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    borderRadius: THEME.radius.pill,
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    boxShadow: THEME.shadow.lifted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {act.label}
                </span>

                {/* Sub-action Button */}
                <button
                  type="button"
                  onClick={() => {
                    act.onClick();
                    setOpen(false);
                  }}
                  aria-label={act.label}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: THEME.radius.full,
                    backgroundColor: isVermilion ? THEME.vermilion : THEME.emeraldGreen,
                    color: THEME.warmIvory,
                    border: `1.5px solid ${THEME.deepForestCharcoal}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: THEME.shadow.lifted,
                    cursor: 'pointer',
                    transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
                  }}
                  className="fab-item-button"
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
          style={{
            width: '52px',
            height: '52px',
            borderRadius: THEME.radius.full,
            backgroundColor: THEME.emeraldGreen,
            color: THEME.warmIvory,
            border: `2px solid ${THEME.deepForestCharcoal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: THEME.shadow.lifted,
            cursor: 'pointer',
            transition: `transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}, background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
          }}
          className="fab-main-button"
        >
          {isSpeedDial ? (
            open ? (
              <X size={24} color={THEME.warmIvory} strokeWidth={2.5} />
            ) : (
              mainIcon || <Plus size={24} color={THEME.warmIvory} strokeWidth={2.5} />
            )
          ) : (
            mainIcon || <Plus size={24} color={THEME.warmIvory} strokeWidth={2.5} />
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
