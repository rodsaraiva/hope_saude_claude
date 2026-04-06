'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, Clock, DollarSign, Loader2 } from 'lucide-react';
import {
  type ConsultationModel,
  createConsultationModel,
  updateConsultationModel,
  deleteConsultationModel,
} from '@/lib/doctor-dashboard-api';

type Props = {
  initialModels: ConsultationModel[];
  onModelsChange: (models: ConsultationModel[]) => void;
};

export function ConsultationModelsManager({ initialModels, onModelsChange }: Props) {
  const [models, setModels] = useState<ConsultationModel[]>(initialModels);
  const [isEditingId, setIsEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState(150);

  const startCreate = () => {
    setIsCreating(true);
    setIsEditingId(null);
    setName('');
    setDurationMinutes(60);
    setPrice(150);
    setError(null);
  };

  const startEdit = (m: ConsultationModel) => {
    setIsEditingId(m.id);
    setIsCreating(false);
    setName(m.name);
    setDurationMinutes(m.durationMinutes);
    setPrice(m.price);
    setError(null);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setIsEditingId(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('O nome do modelo é obrigatório');
      return;
    }
    if (durationMinutes < 15) {
      setError('A duração deve ser de no mínimo 15 minutos');
      return;
    }
    if (price < 0) {
      setError('O preço não pode ser negativo');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (isEditingId) {
        const updated = await updateConsultationModel(isEditingId, { name, durationMinutes, price });
        const newModels = models.map((m) => (m.id === isEditingId ? updated : m));
        setModels(newModels);
        onModelsChange(newModels);
      } else {
        const created = await createConsultationModel({ name, durationMinutes, price });
        const newModels = [...models, created];
        setModels(newModels);
        onModelsChange(newModels);
      }
      cancelForm();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar modelo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este modelo de consulta?')) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await deleteConsultationModel(id);
      const newModels = models.filter((m) => m.id !== id);
      setModels(newModels);
      onModelsChange(newModels);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir modelo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Modelos de Consulta</h2>
          <p className="text-sm text-slate-500">Defina os tipos de consulta, suas durações e preços.</p>
        </div>
        {!isCreating && !isEditingId && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Novo Modelo
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {(isCreating || isEditingId) && (
        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50/50 p-4 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sky-900 mb-4">
            {isCreating ? 'Criar Novo Modelo' : 'Editar Modelo'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome do Modelo</label>
              <input
                type="text"
                placeholder="Ex: Primeira Consulta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Duração (minutos)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Preço (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={cancelForm}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      )}

      {models.length === 0 && !isCreating ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-slate-500">
          Você ainda não possui modelos de consulta. Crie um para que os pacientes possam agendar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <div key={m.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-200 transition-colors">
              <div>
                <h4 className="font-bold text-slate-800">{m.name}</h4>
                <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {m.durationMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    R$ {m.price.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-3">
                <button
                  onClick={() => startEdit(m)}
                  disabled={isLoading || isCreating || isEditingId !== null}
                  className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors disabled:opacity-50"
                  aria-label="Editar modelo"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={isLoading || isCreating || isEditingId !== null}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  aria-label="Excluir modelo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
