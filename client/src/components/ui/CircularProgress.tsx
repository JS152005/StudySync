import React from 'react';
import { THEME } from '../../theme';

export interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 180,
  strokeWidth = 10,
  color = THEME.emeraldGreen,
  trackColor = 'rgba(116, 111, 100, 0.25)',
  children,
  ariaLabel = 'Progress indicator',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clampedValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          display: 'block',
        }}
      >
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: `stroke-dashoffset ${THEME.motion.durationSlow} ${THEME.motion.easeOut}, stroke ${THEME.motion.durationNormal} ${THEME.motion.easeOut}`,
          }}
        />
      </svg>

      {/* Central content slot */}
      {children && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CircularProgress;
