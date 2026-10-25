import React from 'react';
import { THEME } from '../../theme';
import { Check, Minus } from 'lucide-react';

export interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  ariaLabel,
}) => {
  const switchId = id || (label ? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  // Dimensions based on size
  const config = {
    sm: { width: 40, height: 22, thumb: 16, icon: 10, offset: 3 },
    md: { width: 48, height: 26, thumb: 20, icon: 12, offset: 3 },
    lg: { width: 56, height: 30, thumb: 24, icon: 14, offset: 3 },
  }[size];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
      }}
      onClick={() => !disabled && onChange(!checked)}
    >
      {/* Accessible Interactive Switch Track */}
      <div
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-label={ariaLabel || label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{
          width: `${config.width}px`,
          height: `${config.height}px`,
          borderRadius: THEME.radius.pill,
          backgroundColor: checked ? THEME.emeraldGreen : THEME.warmStone,
          border: `1.5px solid ${THEME.deepForestCharcoal}`,
          position: 'relative',
          transition: `background-color ${THEME.motion.durationNormal} ${THEME.motion.easeOut}, border-color ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
          flexShrink: 0,
          outline: 'none',
          padding: '2px',
          boxSizing: 'border-box',
        }}
        className="toggle-switch-focus"
      >
        {/* Animated Thumb */}
        <div
          style={{
            width: `${config.thumb}px`,
            height: `${config.thumb}px`,
            borderRadius: THEME.radius.full,
            backgroundColor: THEME.warmIvory,
            border: `1.5px solid ${THEME.deepForestCharcoal}`,
            position: 'absolute',
            top: `${config.offset - 1.5}px`,
            left: `${config.offset - 1.5}px`,
            transform: checked ? `translateX(${config.width - config.thumb - config.offset * 2}px)` : 'translateX(0)',
            transition: `transform ${THEME.motion.durationNormal} ${THEME.motion.easeSpring}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(38, 53, 47, 0.25)',
          }}
        >
          {/* Dual-cue visual indicator (not color alone) */}
          {checked ? (
            <Check size={config.icon} color={THEME.emeraldGreen} strokeWidth={3} />
          ) : (
            <Minus size={config.icon} color={THEME.warmStone} strokeWidth={2.5} />
          )}
        </div>
      </div>

      {/* Optional Label and Description */}
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <span
              style={{
                fontSize: size === 'sm' ? '12.5px' : '13.5px',
                fontWeight: 700,
                color: THEME.deepForestCharcoal,
                lineHeight: 1.3,
              }}
            >
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '11.5px', color: THEME.warmStone, lineHeight: 1.3, marginTop: '2px' }}>
              {description}
            </span>
          )}
        </div>
      )}

      <style>{`
        .toggle-switch-focus:focus-visible {
          outline: 2px solid var(--color-emerald-green) !important;
          outline-offset: 3px !important;
        }
      `}</style>
    </div>
  );
};

export default ToggleSwitch;
