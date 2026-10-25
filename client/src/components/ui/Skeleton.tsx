import React from 'react';
import { THEME } from '../../theme';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = THEME.radius.sm,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
