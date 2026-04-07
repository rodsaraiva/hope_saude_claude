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
  AlertCircle,
  LayoutTemplate,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  signMedicalRecord,
  getLacunaAuthorizeUrl,
  type MedicalRecord,
} from '@/lib/doctor-dashboard-api';

import { RichTextEditor } from './RichTextEditor';
import { ModalBackdrop } from './ui/ModalBackdrop';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  appointmentId?: number;
  isInline?: boolean;
}

export function MedicalRecordModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId,
  isInline = false,
}: Props) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentRecord, setCurrentRecord] = useState<MedicalRecord | null>(null);
  const [view, setView] = useState<'new' | 'history'>('new');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      void loadRecords();
    }
  }, [isOpen, patientId, search]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchMedicalRecords(patientId, search);
      setRecords(data);

      if (appointmentId) {
        const record = data.find((r) => r.appointmentId === appointmentId);
        if (record) {
          setEditingId(record.id);
          setContent(record.content);
          setCurrentRecord(record);
          setView('new');
        } else {
          setEditingId(null);
          setContent('');
          setCurrentRecord(null);
          setView('new');
        }
      } else if (view !== 'new') {
        setView('history');
      }
    } catch (err) {
      console.error('Erro ao carregar prontuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateMedicalRecord(editingId, content);
      } else {
        await createMedicalRecord({
          patientId,
          appointmentId,
          content,
        });
      }
      await loadRecords();
    } catch (err) {
      console.error('Erro ao salvar prontuário:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!editingId) return;

    const msg =
      'Deseja assinar este prontuário via Lacuna (BirdID, VidaaS, etc.)? Após a assinatura digital, o documento não poderá mais ser editado.';
    if (!confirm(msg)) return;

    localStorage.setItem('pending_signature_record_id', String(editingId));
    localStorage.setItem('pending_signature_content', content);

    const url = getLacunaAuthorizeUrl(editingId, 'medical-record');
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
            <FileText className="h-5 w-5 text-sky-600" />
            Prontuário: {patientName}
          </h3>
          {!isInline && (
            <p className="text-xs text-slate-500 font-medium">
              Gerencie o histórico clínico e evoluções do paciente.
            </p>
          )}
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

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 px-6 bg-white gap-2 py-2 sm:py-0">
        <div className="flex gap-4">
          <button
            onClick={() => setView('new')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ${
              view === 'new'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="h-4 w-4" />
            {editingId ? 'Editar Evolução' : 'Nova Evolução'}
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ${
              view === 'history'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico ({records.length})
          </button>
        </div>

        <div className={`relative w-full ${isInline ? 'max-w-[150px]' : 'max-w-[200px]'}`}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-400 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {loading && records.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
            <p className="text-sm font-medium">Carregando...</p>
          </div>
        ) : view === 'new' ? (
          <div className="space-y-4">
            {currentRecord?.status === 'SIGNED' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">
                      Este prontuário já foi assinado
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Registros assinados não podem ser editados para garantir a integridade legal
                      do documento.
                    </p>
                  </div>
                </div>

                {currentRecord.signature && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" />
                      Assinatura Digital Verificada
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          Data da Assinatura
                        </p>
                        <p className="text-xs text-slate-700 font-medium">
                          {format(
                            parseISO(currentRecord.signatureDate!),
                            "dd/MM/yyyy 'às' HH:mm:ss",
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          Integridade do Conteúdo (Hash)
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono break-all bg-white/50 p-1 rounded border border-sky-100">
                          {currentRecord.signedHash}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="bg-white">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Evolução do Paciente
                </label>
                {currentRecord?.status !== 'SIGNED' && (
                  <button
                    onClick={() =>
                      setContent(
                        (prev) =>
                          prev +
                          '<p><strong>S (Subjetivo):</strong></p><p><strong>O (Objetivo):</strong></p><p><strong>A (Avaliação):</strong></p><p><strong>P (Plano):</strong></p>',
                      )
                    }
                    className="flex items-center gap-1.5 text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-md hover:bg-sky-100 transition-colors"
                  >
                    <LayoutTemplate className="h-3 w-3" />
                    ADICIONAR TEMPLATE SOAP
                  </button>
                )}
              </div>

              <RichTextEditor
                content={content}
                onChange={setContent}
                readOnly={currentRecord?.status === 'SIGNED'}
                className={isInline ? 'min-h-[300px]' : 'min-h-[400px]'}
              />
            </div>

            {currentRecord?.status !== 'SIGNED' && (
              <div className="flex justify-end gap-3">
                {editingId && (
                  <button
                    disabled={signing}
                    onClick={handleSign}
                    className="flex items-center gap-2 rounded-xl border border-emerald-600 px-6 py-2.5 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
                  >
                    {signing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isInline ? 'Assinar via Lacuna' : 'Assinar Digitalmente (Lacuna)'}
                  </button>
                )}
                <button
                  disabled={saving || !content.trim()}
                  onClick={handleSave}
                  className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-50 active:scale-95"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isInline ? 'Salvar' : 'Salvar Rascunho'}
                </button>
              </div>
            )}

            {/* Auditoria para o registro atual */}
            {currentRecord?.audits && currentRecord.audits.length > 0 && (
              <div className="mt-8">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <History className="h-3 w-3" />
                  Versões Anteriores / Auditoria
                </h4>
                <div className="space-y-3">
                  {currentRecord.audits.map((audit) => (
                    <div
                      key={audit.id}
                      className="rounded-lg border border-slate-100 bg-white p-3 text-xs"
                    >
                      <div className="flex items-center justify-between mb-2 text-slate-500">
                        <span className="font-bold">
                          Alterado em: {format(parseISO(audit.changedAt), "dd/MM/yyyy 'às' HH:mm")}
                        </span>
                        <span className="italic">{audit.reason}</span>
                      </div>
                      <div
                        className="prose prose-xs prose-slate text-slate-600 line-clamp-2 hover:line-clamp-none transition-all cursor-pointer"
                        dangerouslySetInnerHTML={{ __html: audit.content }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <History className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-800">
                  {search ? 'Nenhum resultado para sua busca' : 'Nenhum registro encontrado'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {search
                    ? 'Tente outros termos ou limpe a busca.'
                    : 'Este paciente ainda não possui histórico de prontuários.'}
                </p>
              </div>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-md">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(record.createdAt), "dd 'de' MMMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                      {record.status === 'SIGNED' ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            ASSINADO DIGITALMENTE
                          </div>
                          {record.signedHash && (
                            <p
                              className="text-[8px] text-slate-400 font-mono line-clamp-1 ml-1"
                              title={record.signedHash}
                            >
                              Hash: {record.signedHash}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <AlertCircle className="h-2.5 w-2.5" />
                          RASCUNHO
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(record.id);
                        setContent(record.content);
                        setCurrentRecord(record);
                        setView('new');
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-sky-600 transition-colors"
                    >
                      {record.status === 'SIGNED' ? 'Visualizar' : 'Editar'}
                    </button>
                  </div>
                  <div
                    className="prose prose-sm prose-slate max-w-none text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: record.content }}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isInline && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Os registros são assinados digitalmente e possuem validade legal.
          </p>
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
    <ModalBackdrop onClose={onClose} label="Prontuário" className="z-[60]">
      {contentMarkup}
    </ModalBackdrop>
  );
}
