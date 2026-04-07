'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { ModalBackdrop } from './ModalBackdrop';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal genérico com header (título + X) e footer opcional.
 * Usa o ModalBackdrop por baixo, que cuida de ESC, click-outside e a11y.
 */
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalBackdrop onClose={onClose} label={title}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h3 id="modal-title" className="text-xl font-bold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8">{children}</div>

        {footer && (
          <div className="border-t border-slate-100 bg-slate-50 p-6 text-right">{footer}</div>
        )}
      </div>
    </ModalBackdrop>
  );
}
