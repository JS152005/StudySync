import React from 'react';
import { THEME } from '../../theme';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'box';
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'pill',
  ariaLabel = 'Segmented options',
  className = '',
}: SegmentedControlProps<T>) {
  const isPill = variant === 'pill';
  const borderRadius = isPill ? THEME.radius.pill : THEME.radius.md;
  const paddingY = size === 'sm' ? '4px' : '6px';
  const paddingX = size === 'sm' ? '10px' : '14px';
  const fontSize = size === 'sm' ? '12px' : '13px';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`segmented-control-container ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        backgroundColor: THEME.warmIvory,
        border: `1.5px solid ${THEME.deepForestCharcoal}`,
        borderRadius,
        gap: '4px',
        maxWidth: '100%',
        overflowX: 'auto',
        userSelect: 'none',
        boxShadow: THEME.shadow.subtle,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: `${paddingY} ${paddingX}`,
              fontSize,
              fontWeight: isSelected ? 700 : 600,
              borderRadius: isPill ? THEME.radius.pill : THEME.radius.sm,
              backgroundColor: isSelected ? THEME.emeraldGreen : 'transparent',
              color: isSelected ? THEME.warmIvory : THEME.deepForestCharcoal,
              border: isSelected ? `1.5px solid ${THEME.emeraldGreen}` : '1.5px solid transparent',
              cursor: 'pointer',
              transition: `background-color ${THEME.motion.durationFast} ${THEME.motion.easeOut}, color ${THEME.motion.durationFast} ${THEME.motion.easeOut}, transform ${THEME.motion.durationFast} ${THEME.motion.easeSpring}`,
              whiteSpace: 'nowrap',
              transform: isSelected ? 'scale(1.01)' : 'scale(1)',
              outline: 'none',
            }}
            className="segmented-item-focus"
          >
            {opt.icon && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: isSelected ? THEME.warmIvory : THEME.deepForestCharcoal,
                }}
              >
                {opt.icon}
              </span>
            )}
            <span style={{ color: isSelected ? THEME.warmIvory : THEME.deepForestCharcoal }}>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: THEME.radius.pill,
                  backgroundColor: isSelected ? THEME.warmIvory : THEME.warmStone,
                  color: isSelected ? THEME.emeraldGreen : THEME.warmIvory,
                  fontWeight: 800,
                  marginLeft: '2px',
                }}
              >
                {opt.count}
              </span>
            )}
            {opt.badge}
          </button>
        );
      })}

      <style>{`
        .segmented-item-focus:focus-visible {
          outline: 2px solid var(--color-emerald-green) !important;
          outline-offset: 1px !important;
        }
      `}</style>
    </div>
  );
}

export default SegmentedControl;
