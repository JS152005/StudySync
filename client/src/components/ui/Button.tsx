import React from 'react';
import { THEME } from '../../theme';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'vermilion' | 'accent' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  shape?: 'rounded' | 'pill' | 'sharp';
  loading?: boolean;
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
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      style = {},
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Resolve variant class
    let variantClass = 'btn-secondary';
    if (variant === 'primary') variantClass = 'btn-primary';
    else if (variant === 'vermilion' || variant === 'accent') variantClass = 'btn-vermilion';
    else if (variant === 'ghost') variantClass = 'btn-ghost';
    else if (variant === 'outline') variantClass = 'btn-secondary';

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

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`${variantClass} ${sizeClass} ${shapeClass} ${className}`.trim()}
        style={{
          ...style,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.7 : 1,
        }}
        {...props}
      >
        {loading && (
          <Loader2
            size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16}
            className="spinner"
            color={
              variant === 'primary' || variant === 'vermilion' || variant === 'accent'
                ? THEME.warmIvory
                : THEME.deepForestCharcoal
            }
          />
        )}
        {!loading && leftIcon}
        {children && <span>{children}</span>}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
