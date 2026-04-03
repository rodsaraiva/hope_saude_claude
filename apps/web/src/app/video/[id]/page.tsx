'use client';

import LiveKitVideoCall from '@/components/LiveKitVideoCall';

export default function LegacyVideoPage({ params }: { params: { id: string } }) {
  return <LiveKitVideoCall appointmentId={params.id} />;
}
