'use client';

import '@livekit/components-styles';
import {
  LiveKitRoom,
  VideoConference,
  DisconnectButton,
  useConnectionState,
  useRemoteParticipants,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import {
  PhoneOff,
  Video,
  FileText,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  Pill,
} from 'lucide-react';
import { useVideoCall } from '@/hooks/useVideoCall';
import { MedicalRecordModal } from '@/components/MedicalRecordModal';
import { PrescriptionModal } from '@/components/PrescriptionModal';
import { useState, useEffect } from 'react';

function CallStatus() {
  const conn = useConnectionState();
  const remotes = useRemoteParticipants();
  if (conn !== ConnectionState.Connected) {
    return <span>Conectando...</span>;
  }
  if (remotes.length === 0) {
    return <span>Aguardando o outro participante...</span>;
  }
  return <span>Conectado</span>;
}

type Props = {
  appointmentId: string;
};

export default function LiveKitVideoCall({ appointmentId }: Props) {
  const { token, livekitUrl, appointment, error, loading, goBack } = useVideoCall(appointmentId);
  const [isMedicalRecordOpen, setIsMedicalRecordOpen] = useState(false);
  const [isMedicalRecordMinimized, setIsMedicalRecordMinimized] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<'record' | 'prescription'>('record');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        setUserRole(payload.role);
      } catch (e) {
        console.error('Erro ao ler token:', e);
      }
    }
  }, []);

  const isDoctor = userRole === 'DOCTOR';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        Carregando teleconsulta...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <p>{error}</p>
        <button
          type="button"
          className="rounded-lg bg-slate-700 px-4 py-2 hover:bg-slate-600"
          onClick={goBack}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect
        audio
        video
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex shrink-0 items-center justify-between bg-slate-950 p-4 shadow-md">
          <div className="flex items-center gap-4">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Video className="h-5 w-5 text-sky-400" aria-hidden />
              Teleconsulta
            </h1>
            <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-300">
              <CallStatus />
            </div>
          </div>

          {isDoctor && appointment && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (
                    isMedicalRecordOpen &&
                    activeSideTab === 'record' &&
                    !isMedicalRecordMinimized
                  ) {
                    setIsMedicalRecordOpen(false);
                  } else {
                    setIsMedicalRecordOpen(true);
                    setActiveSideTab('record');
                    setIsMedicalRecordMinimized(false);
                  }
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  isMedicalRecordOpen && !isMedicalRecordMinimized && activeSideTab === 'record'
                    ? 'bg-sky-600 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText className="h-4 w-4" />
                Prontuário
              </button>

              <button
                onClick={() => {
                  if (
                    isMedicalRecordOpen &&
                    activeSideTab === 'prescription' &&
                    !isMedicalRecordMinimized
                  ) {
                    setIsMedicalRecordOpen(false);
                  } else {
                    setIsMedicalRecordOpen(true);
                    setActiveSideTab('prescription');
                    setIsMedicalRecordMinimized(false);
                  }
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  isMedicalRecordOpen &&
                  !isMedicalRecordMinimized &&
                  activeSideTab === 'prescription'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Pill className="h-4 w-4" />
                Receita
              </button>
            </div>
          )}
        </header>

        <main className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ${isMedicalRecordOpen && !isMedicalRecordMinimized ? 'mr-[450px]' : ''}`}
          >
            <div className="min-h-0 flex-1 [&_.lk-control-bar]:hidden p-4">
              <VideoConference className="h-full" />
            </div>

            <footer className="flex shrink-0 justify-center gap-6 border-t border-slate-800 p-6">
              <DisconnectButton
                title="Desligar"
                className="rounded-full bg-red-600 p-4 text-white transition-colors hover:bg-red-700"
              >
                <PhoneOff className="h-6 w-6" />
              </DisconnectButton>
            </footer>
          </div>

          {isDoctor && appointment && (
            <div
              className={`fixed top-[73px] bottom-0 right-0 w-[450px] bg-white text-slate-900 shadow-2xl transition-all duration-300 transform ${
                isMedicalRecordOpen
                  ? isMedicalRecordMinimized
                    ? 'translate-y-[calc(100%-48px)] translate-x-[-20px] scale-90 opacity-90'
                    : 'translate-x-0'
                  : 'translate-x-full'
              } z-40 border-l border-slate-200 flex flex-col`}
            >
              {/* Barra de minimizar */}
              <div
                role="button"
                tabIndex={0}
                aria-label={
                  isMedicalRecordMinimized ? 'Expandir prontuário' : 'Minimizar prontuário'
                }
                onClick={() => setIsMedicalRecordMinimized(!isMedicalRecordMinimized)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsMedicalRecordMinimized(!isMedicalRecordMinimized);
                  }
                }}
                className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white cursor-pointer hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-inset"
              >
                <div className="flex items-center gap-2">
                  {activeSideTab === 'record' ? (
                    <FileText className="h-4 w-4 text-sky-400" />
                  ) : (
                    <Pill className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {activeSideTab === 'record' ? 'Prontuário em Tempo Real' : 'Emissão de Receita'}
                  </span>
                  {isMedicalRecordMinimized && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/30">
                      RASCUNHO ABERTO
                    </span>
                  )}
                </div>
                <button className="p-1 hover:bg-white/10 rounded transition-colors">
                  {isMedicalRecordMinimized ? (
                    <Maximize2 className="h-4 w-4" />
                  ) : (
                    <Minimize2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div
                className={`flex-1 overflow-hidden transition-opacity duration-200 ${isMedicalRecordMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                {activeSideTab === 'record' ? (
                  <MedicalRecordModal
                    isOpen={true}
                    onClose={() => setIsMedicalRecordOpen(false)}
                    patientId={appointment.patientId}
                    patientName={appointment.patientName}
                    appointmentId={appointment.id}
                    isInline={true}
                  />
                ) : (
                  <PrescriptionModal
                    isOpen={true}
                    onClose={() => setIsMedicalRecordOpen(false)}
                    patientId={appointment.patientId}
                    patientName={appointment.patientName}
                    appointmentId={appointment.id}
                    isInline={true}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </LiveKitRoom>
    </div>
  );
}
