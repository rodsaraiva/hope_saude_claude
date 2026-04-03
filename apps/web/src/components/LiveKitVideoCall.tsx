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
import { PhoneOff, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000';

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
  const router = useRouter();

  const [token, setToken] = useState<string | undefined>();
  const [livekitUrl, setLivekitUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem('token');
    if (!auth) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/video/token/${appointmentId}`, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        if (!res.ok) {
          const msg =
            res.status === 403
              ? 'Consulta não confirmada ou inexistente.'
              : 'Não foi possível iniciar a teleconsulta.';
          if (!cancelled) setError(msg);
          return;
        }
        const data = (await res.json()) as {
          token: string;
          livekitUrl?: string;
        };
        if (!cancelled) {
          setToken(data.token);
          setLivekitUrl(data.livekitUrl ?? 'ws://localhost:7880');
        }
      } catch {
        if (!cancelled) setError('Falha de rede ao obter token.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, router]);

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
          onClick={() => router.back()}
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
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Video className="h-5 w-5 text-sky-400" aria-hidden />
            Teleconsulta
          </h1>
          <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-300">
            <CallStatus />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col p-4">
          <div className="min-h-0 flex-1 [&_.lk-control-bar]:hidden">
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
        </main>
      </LiveKitRoom>
    </div>
  );
}
