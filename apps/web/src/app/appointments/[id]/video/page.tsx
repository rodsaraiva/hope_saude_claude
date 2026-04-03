'use client';

import { useParams } from 'next/navigation';
import LiveKitVideoCall from '@/components/LiveKitVideoCall';

export default function AppointmentVideoPage() {
  const params = useParams();
  const appointmentId = typeof params?.id === 'string' ? params.id : '';

  return <LiveKitVideoCall appointmentId={appointmentId} />;
}
