import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export function useVideoCall(appointmentId: string) {
  const router = useRouter();

  const [token, setToken] = useState<string | undefined>();
  const [livekitUrl, setLivekitUrl] = useState<string | undefined>();
  const [appointment, setAppointment] = useState<{ id: number; patientId: number; patientName: string; doctorId: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<any>(`/video/token/${appointmentId}`);
        if (!cancelled) {
          setToken(data.token);
          setLivekitUrl(data.livekitUrl ?? 'ws://localhost:7880');
          setAppointment(data.appointment);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        if (err.status === 401) {
          router.replace('/login');
          return;
        }

        const msg =
          err.status === 403
            ? 'Consulta não confirmada ou inexistente.'
            : 'Não foi possível iniciar a teleconsulta.';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, router]);

  return {
    token,
    livekitUrl,
    appointment,
    error,
    loading,
    goBack: () => router.back(),
  };
}