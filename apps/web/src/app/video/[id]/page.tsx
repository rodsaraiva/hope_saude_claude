'use client';

import { use } from 'react';
import LiveKitVideoCall from '@/components/LiveKitVideoCall';

export default function LegacyVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LiveKitVideoCall appointmentId={id} />;
}
