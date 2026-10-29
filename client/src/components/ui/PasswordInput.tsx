import React, { useState } from 'react';
import { THEME } from '../../theme';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  ariaLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, ariaLabel, style, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          style={{ paddingRight: '42px', ...style }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={ariaLabel || (showPassword ? "Hide password" : "Show password")}
        >
          {showPassword ? <EyeOff size={16} color={THEME.deepForestCharcoal} /> : <Eye size={16} color={THEME.warmStone} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
