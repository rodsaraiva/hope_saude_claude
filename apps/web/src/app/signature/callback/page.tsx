'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { signMedicalRecord, signPrescription } from '@/lib/doctor-dashboard-api';

export default function LacunaSignatureCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error === 'access_denied' ? 'Acesso negado pelo usuário.' : 'Erro na autenticação.');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('Código de autorização não encontrado.');
      return;
    }

    let recordId: number | null = null;
    let type: 'medical-record' | 'prescription' = 'medical-record';
    try {
      if (state) {
        const decodedState = JSON.parse(decodeURIComponent(state));
        recordId = decodedState.recordId;
        type = decodedState.type || 'medical-record';
      }
    } catch (e) {
      console.error('Erro ao ler o estado:', e);
    }

    if (!recordId) {
      const storedId = localStorage.getItem('pending_signature_record_id');
      if (storedId) recordId = parseInt(storedId, 10);
      const storedType = localStorage.getItem('pending_signature_type') as any;
      if (storedType) type = storedType;
    }

    if (!recordId) {
      setStatus('error');
      setErrorMsg('Identificação do documento não encontrada.');
      return;
    }

    const processSignature = async () => {
      try {
        if (type === 'medical-record') {
          await signMedicalRecord(recordId as number, { code });
        } else {
          await signPrescription(recordId as number, { code });
        }
        
        setStatus('success');
        
        // Limpa cache
        localStorage.removeItem('pending_signature_record_id');
        localStorage.removeItem('pending_signature_content');
        localStorage.removeItem('pending_signature_type');

        setTimeout(() => {
          router.replace('/agenda');
        }, 2000);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message || 'Falha ao processar a assinatura digital.');
      }
    };

    void processSignature();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        {status === 'processing' && (
          <div className="space-y-6">
            <Loader2 className="mx-auto h-16 w-16 animate-spin text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900">Processando Assinatura</h1>
            <p className="text-slate-500 font-medium">
              Estamos comunicando com o Lacuna Software (Provedor) para validar sua assinatura eletrônica. Aguarde um instante...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Assinatura Concluída!</h1>
            <p className="text-slate-500 font-medium">
              Seu documento foi assinado digitalmente com sucesso. Redirecionando para a agenda...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Falha na Assinatura</h1>
            <p className="text-red-600 font-medium">{errorMsg}</p>
            <button 
              onClick={() => router.replace('/agenda')}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-bold text-white transition hover:bg-slate-800"
            >
              Voltar para Agenda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
