'use client';

import { useEffect, useRef, useState } from 'react';

export default function VideoCallPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const authToken = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/video/token/${params.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setToken(data.token);
    };
    fetchToken();
  }, [params.id]);

  const startCall = async () => {
    setInCall(true);
    try {
      if (localVideoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      // Dispositivos de mídia indisponíveis (ambiente de teste ou sem permissão)
    }
  };

  const endCall = () => {
    setInCall(false);
    window.location.href = '/dashboard';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-white">Sala de Consulta #{params.id}</h1>
        {inCall && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30 text-xs font-bold animate-pulse">
            <div className="h-2 w-2 bg-green-500 rounded-full" />
            Conectado
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
          <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md text-white px-3 py-1 rounded-lg text-sm font-medium border border-white/10">
            Você
          </div>
        </div>
        <div className="relative bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden flex items-center justify-center shadow-2xl">
          {inCall ? (
            <video ref={remoteVideoRef} autoPlay className="w-full h-full object-cover" />
          ) : (
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full border-2 border-slate-600 border-t-sky-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Aguardando outro participante...</p>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md text-white px-3 py-1 rounded-lg text-sm font-medium border border-white/10">
            Especialista
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-center items-center gap-6 p-4">
        {!inCall ? (
          <button 
            onClick={startCall}
            className="group relative flex items-center gap-2 px-10 py-4 bg-sky-600 text-white rounded-full font-bold shadow-lg shadow-sky-600/20 hover:bg-sky-700 transition-all hover:scale-105 active:scale-95"
          >
            Entrar na Chamada
          </button>
        ) : (
          <button 
            onClick={endCall}
            className="group relative flex items-center gap-2 px-10 py-4 bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
          >
            Encerrar Consulta
          </button>
        )}
      </div>
    </div>
  );
}
