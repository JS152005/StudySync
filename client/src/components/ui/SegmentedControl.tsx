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
  const paddingY = size === 'sm' ? '5px' : '7px';
  const paddingX = size === 'sm' ? '12px' : '16px';
  const fontSize = size === 'sm' ? '12.5px' : '13.5px';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`segmented-control-container ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        backgroundColor: '#121826',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius,
        gap: '4px',
        maxWidth: '100%',
        overflowX: 'auto',
        userSelect: 'none',
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
              justifyContent: 'center',
              gap: '6px',
              padding: `${paddingY} ${paddingX}`,
              fontSize,
              fontWeight: isSelected ? 600 : 500,
              borderRadius: isPill ? THEME.radius.pill : THEME.radius.sm,
              backgroundColor: isSelected ? THEME.accent : 'transparent',
              color: isSelected ? '#FFFFFF' : '#94A3B8',
              border: 'none',
              cursor: 'pointer',
              transition: `all ${THEME.motion.durationFast} ${THEME.motion.easeOut}`,
              whiteSpace: 'nowrap',
              boxShadow: isSelected ? '0 1px 8px rgba(14, 165, 233, 0.35)' : 'none',
              outline: 'none',
            }}
            className="segmented-item-interactive"
          >
            {opt.icon && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: isSelected ? '#FFFFFF' : 'inherit',
                }}
              >
                {opt.icon}
              </span>
            )}
            <span style={{ color: isSelected ? '#FFFFFF' : 'inherit', lineHeight: 1 }}>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '18px',
                  padding: '0 6px',
                  borderRadius: THEME.radius.pill,
                  fontSize: '11px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#FFFFFF' : '#94A3B8',
                  marginLeft: '4px',
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
        .segmented-item-interactive:hover:not([aria-checked="true"]) {
          background-color: rgba(255, 255, 255, 0.06) !important;
          color: #F8FAFC !important;
        }
        .segmented-item-interactive:focus-visible {
          outline: 2px solid var(--color-emerald-green) !important;
          outline-offset: 1px !important;
        }
      `}</style>
    </div>
  );
}

export default SegmentedControl;
