import React, { useEffect, useRef } from 'react';
import { THEME } from '../../theme';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = '580px',
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="modal-content"
        style={{
          maxWidth,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: description ? '6px' : '18px',
          }}
        >
          {title && (
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  fontSize: '19px',
                  fontWeight: 800,
                  color: THEME.deepForestCharcoal,
                  fontFamily: 'var(--font-serif)',
                }}
              >
                {title}
              </h2>
              {description && (
                <p style={{ fontSize: '13px', color: THEME.warmStone, marginTop: '4px' }}>
                  {description}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-ghost"
            style={{
              padding: '6px',
              borderRadius: THEME.radius.full,
              color: THEME.deepForestCharcoal,
              border: 'none',
              marginLeft: 'auto',
            }}
          >
            <X size={18} color={THEME.deepForestCharcoal} />
          </button>
        </div>

        {/* Modal Body */}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
