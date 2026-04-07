'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Save,
  Clock,
  History,
  Loader2,
  FileText,
  Plus,
  CheckCircle2,
  Trash2,
  Pill,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import {
  fetchPrescriptions,
  createPrescription,
  updatePrescription,
  getLacunaAuthorizeUrl,
  type Prescription,
  type Medication,
} from '@/lib/doctor-dashboard-api';
import { ModalBackdrop } from './ui/ModalBackdrop';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  appointmentId?: number;
  isInline?: boolean;
}

export function PrescriptionModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId,
  isInline = false,
}: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [observations, setObservations] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<Prescription | null>(null);
  const [view, setView] = useState<'new' | 'history'>('new');

  useEffect(() => {
    if (isOpen) {
      void loadPrescriptions();
    }
  }, [isOpen, patientId]);

  const loadPrescriptions = async () => {
    setLoading(true);
    try {
      const data = await fetchPrescriptions(patientId);
      setPrescriptions(data);

      if (appointmentId) {
        const prescription = data.find((p) => p.appointmentId === appointmentId);
        if (prescription) {
          setEditingId(prescription.id);
          setMedications(JSON.parse(prescription.medications));
          setObservations(prescription.observations || '');
          setCurrentPrescription(prescription);
          setView('new');
        } else {
          resetForm();
        }
      } else {
        setView('history');
      }
    } catch (err) {
      console.error('Erro ao carregar receitas:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setMedications([]);
    setObservations('');
    setCurrentPrescription(null);
    setView('new');
  };

  const handleAddMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', instructions: '' }]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleSave = async () => {
    if (medications.length === 0) return;
    setSaving(true);
    try {
      const medicationsJson = JSON.stringify(medications);
      if (editingId) {
        await updatePrescription(editingId, { medications: medicationsJson, observations });
      } else {
        await createPrescription({
          patientId,
          appointmentId,
          medications: medicationsJson,
          observations,
        });
      }
      await loadPrescriptions();
    } catch (err) {
      console.error('Erro ao salvar receita:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!editingId) return;
    if (
      !confirm(
        'Deseja assinar esta receita digitalmente (BirdID, VidaaS, NeoID)? Após a assinatura digital, ela não poderá mais ser editada.',
      )
    )
      return;

    localStorage.setItem('pending_signature_record_id', String(editingId));
    localStorage.setItem('pending_signature_type', 'prescription');

    const url = getLacunaAuthorizeUrl(editingId, 'prescription');
    window.location.href = url;
  };

  if (!isOpen && !isInline) return null;

  const contentMarkup = (
    <div
      className={`flex flex-col w-full bg-white ${isInline ? 'h-full' : 'max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Pill className="h-5 w-5 text-emerald-600" />
            Receita Médica: {patientName}
          </h3>
        </div>
        {!isInline && (
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-50 px-6 bg-white">
        <button
          onClick={() => setView('new')}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ${
            view === 'new'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Plus className="h-4 w-4" />
          {editingId ? 'Editar Receita' : 'Nova Receita'}
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ml-4 ${
            view === 'history'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="h-4 w-4" />
          Histórico ({prescriptions.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {loading && prescriptions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Carregando...</p>
          </div>
        ) : view === 'new' ? (
          <div className="space-y-6">
            {currentPrescription?.status === 'SIGNED' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">
                      Esta receita já foi assinada
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Documentos assinados digitalmente não podem ser alterados.
                    </p>
                  </div>
                </div>
                {currentPrescription.signedHash && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" />
                      Assinatura Digital BirdID Verificada
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono break-all bg-white/50 p-1 rounded border border-sky-100">
                      Hash: {currentPrescription.signedHash}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Medicamentos
                </h4>
                {currentPrescription?.status !== 'SIGNED' && (
                  <button
                    onClick={handleAddMedication}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Adicionar Medicamento
                  </button>
                )}
              </div>

              {medications.map((med, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 relative group"
                >
                  {currentPrescription?.status !== 'SIGNED' && (
                    <button
                      onClick={() => handleRemoveMedication(index)}
                      className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Medicamento
                      </label>
                      <input
                        disabled={currentPrescription?.status === 'SIGNED'}
                        value={med.name}
                        onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                        placeholder="Ex: Amoxicilina"
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Dosagem / Posologia
                      </label>
                      <input
                        disabled={currentPrescription?.status === 'SIGNED'}
                        value={med.dosage}
                        onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                        placeholder="Ex: 500mg"
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Frequência
                      </label>
                      <input
                        disabled={currentPrescription?.status === 'SIGNED'}
                        value={med.frequency}
                        onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                        placeholder="Ex: 8 em 8 horas"
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Orientações Adicionais
                      </label>
                      <input
                        disabled={currentPrescription?.status === 'SIGNED'}
                        value={med.instructions}
                        onChange={(e) =>
                          handleMedicationChange(index, 'instructions', e.target.value)
                        }
                        placeholder="Ex: Tomar após as refeições"
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {medications.length === 0 && (
                <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-400">Nenhum medicamento adicionado.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Observações Gerais
                </label>
                <textarea
                  disabled={currentPrescription?.status === 'SIGNED'}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Orientações de repouso, dieta, etc."
                  rows={3}
                  className="w-full text-sm border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {currentPrescription?.status !== 'SIGNED' && (
              <div className="flex justify-end gap-3 pt-4">
                {editingId && (
                  <button
                    onClick={handleSign}
                    className="flex items-center gap-2 rounded-xl border border-emerald-600 px-6 py-2.5 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50 active:scale-95"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Assinar via Lacuna Software
                  </button>
                )}
                <button
                  disabled={saving || medications.length === 0}
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50 active:scale-95"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Rascunho
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <History className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-800">Nenhuma receita encontrada</p>
              </div>
            ) : (
              prescriptions.map((p) => {
                const meds = JSON.parse(p.medications) as Medication[];
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(p.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        {p.status === 'SIGNED' ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <ShieldCheck className="h-2.5 w-2.5" /> ASSINADA
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <AlertCircle className="h-2.5 w-2.5" /> RASCUNHO
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingId(p.id);
                          setMedications(meds);
                          setObservations(p.observations || '');
                          setCurrentPrescription(p);
                          setView('new');
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        {p.status === 'SIGNED' ? 'Visualizar' : 'Editar'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {meds.map((m, idx) => (
                        <div key={idx} className="text-xs text-slate-700 flex gap-2">
                          <span className="font-bold">• {m.name}</span>
                          <span className="text-slate-500">({m.dosage})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isInline && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2 transition hover:bg-slate-200 rounded-lg"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );

  if (isInline) return contentMarkup;

  return (
    <ModalBackdrop onClose={onClose} label="Receita médica" className="z-[60]">
      {contentMarkup}
    </ModalBackdrop>
  );
}
