import React from 'react';
import { Loader2 } from 'lucide-react';
import { triggerSparks, SparkColor } from './SparkEffect';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'vermilion' | 'accent' | 'ghost' | 'outline' | 'mint';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  shape?: 'rounded' | 'pill' | 'sharp';
  loading?: boolean;
  spark?: boolean;
  sparkColor?: SparkColor;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      shape = 'rounded',
      loading = false,
      spark,
      sparkColor,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      style = {},
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    // Resolve variant class
    let variantClass = 'btn-secondary';
    if (variant === 'primary') variantClass = 'btn-primary';
    else if (variant === 'vermilion' || variant === 'accent') variantClass = 'btn-vermilion';
    else if (variant === 'ghost') variantClass = 'btn-ghost';
    else if (variant === 'outline') variantClass = 'btn-outline';
    else if (variant === 'mint') variantClass = 'btn-mint';

    // Resolve size class
    let sizeClass = '';
    if (size === 'sm') sizeClass = 'btn-sm';
    else if (size === 'lg') sizeClass = 'btn-lg';
    else if (size === 'icon') sizeClass = shape === 'pill' ? 'btn-icon-pill' : 'btn-icon';

    // Resolve shape class
    let shapeClass = '';
    if (shape === 'pill') shapeClass = 'btn-pill';
    else if (shape === 'sharp') shapeClass = 'radius-sharp';

    const isDisabled = disabled || loading;

    // Automatically enable spark on primary/vermilion/mint unless explicitly set to false
    const shouldSpark = spark ?? (variant === 'primary' || variant === 'vermilion' || variant === 'accent' || variant === 'mint');

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;

      if (shouldSpark) {
        const resolvedColor: SparkColor =
          sparkColor ||
          (variant === 'vermilion' || variant === 'accent'
            ? 'crimson'
            : variant === 'mint'
            ? 'mint'
            : 'azure');
        triggerSparks(e, resolvedColor, 10);
      }

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onClick={handleClick}
        className={`${variantClass} ${sizeClass} ${shapeClass} ${className}`.trim()}
        style={{
          ...style,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        {...props}
      >
        {loading && (
          <Loader2
            size={size === 'sm' ? 13 : size === 'lg' ? 18 : 15}
            className="spinner"
            style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}
          />
        )}
        {!loading && leftIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {leftIcon}
          </span>
        )}
        {children && (
          <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
            {children}
          </span>
        )}
        {!loading && rightIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
