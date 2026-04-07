'use client';

import { useEffect, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
  /** Se true, clicar no backdrop fecha o modal (default). */
  closeOnBackdropClick?: boolean;
  /** Aria-label do dialog; se ausente usa aria-modal sozinho. */
  label?: string;
  className?: string;
}

/**
 * Backdrop genérico para modais.
 *
 * a11y:
 * - `role="dialog"` + `aria-modal="true"`
 * - Escape fecha (listener no window)
 * - `onKeyDown={onClose}` no próprio backdrop para satisfazer
 *   `click-events-have-key-events` do eslint-plugin-jsx-a11y
 * - `stopPropagation` no container interno (para clicar dentro do modal
 *   sem fechar)
 *
 * Substitui o padrão `<div onClick={onClose}>...</div>` que existia
 * repetido em 8+ modais com eslint-disable.
 */
export function ModalBackdrop({
  onClose,
  children,
  closeOnBackdropClick = true,
  label,
  className = '',
}: Props) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    // Só fecha se o click foi no backdrop, não no conteúdo
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
