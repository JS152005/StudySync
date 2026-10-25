import React, { createContext, useContext, useState, useCallback } from 'react';
import { THEME } from '../../theme';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, d?: number) => showToast(msg, 'success', d), [showToast]);
  const error = useCallback((msg: string, d?: number) => showToast(msg, 'error', d), [showToast]);
  const info = useCallback((msg: string, d?: number) => showToast(msg, 'info', d), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          return (
            <div
              key={t.id}
              className={`toast-item ${isSuccess ? 'toast-success' : isError ? 'toast-error' : ''}`}
              role="status"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isSuccess && <CheckCircle2 size={18} color={THEME.emeraldGreen} />}
                {isError && <AlertCircle size={18} color={THEME.vermilion} />}
                {!isSuccess && !isError && <Info size={18} color={THEME.emeraldGreen} />}
                <span style={{ fontSize: '13px', fontWeight: 600, color: THEME.deepForestCharcoal }}>
                  {t.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={15} color={THEME.warmStone} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showToast: (msg) => console.log(msg),
      success: (msg) => console.log(msg),
      error: (msg) => console.error(msg),
      info: (msg) => console.log(msg),
    };
  }
  return context;
};

export default ToastProvider;
