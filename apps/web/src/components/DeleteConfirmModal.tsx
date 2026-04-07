'use client';

import { Trash2, AlertTriangle, Calendar, X } from 'lucide-react';
import { Modal } from './ui/Modal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRemoveOnlyThis: () => void;
  onRemoveAll: () => void;
  title?: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onRemoveOnlyThis,
  onRemoveAll,
  title = 'Remover disponibilidade',
  description = 'Este horário faz parte de uma série recorrente. O que deseja fazer?',
}: DeleteConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button
          onClick={onClose}
          className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
        >
          Não, manter horários
        </button>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 className="h-8 w-8" />
          </div>
          <p className="text-sm text-slate-600">{description}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onRemoveOnlyThis}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-4 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
          >
            <Calendar className="h-5 w-5 text-sky-600" />
            Excluir apenas este horário
          </button>

          <button
            onClick={onRemoveAll}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-4 font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
          >
            <Trash2 className="h-5 w-5" />
            Excluir todas as recorrências
          </button>
        </div>
      </div>
    </Modal>
  );
}
