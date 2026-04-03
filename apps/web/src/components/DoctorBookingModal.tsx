'use client';

import { getSlotDateISO } from '@/lib/patient-scheduling';

type DoctorRow = {
  id: number;
  userId: number;
  specialty: string;
  availability: string | null;
  user?: { name: string; email?: string };
};

type Props = {
  doctor: DoctorRow;
  onClose: () => void;
  onBook: (doctorUserId: number, dateIso: string) => Promise<void>;
};

export default function DoctorBookingModal({ doctor, onClose, onBook }: Props) {
  const slots = doctor.availability ? JSON.parse(doctor.availability) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doctor-booking-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h3 id="doctor-booking-title" className="text-xl font-bold text-gray-900">
            Agenda de Dr. {doctor?.user?.name || 'Médico'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto p-6">
          {slots.length === 0 ? (
            <p className="py-4 text-center text-gray-500">Nenhum horário disponível no momento.</p>
          ) : (
            slots.map((slot: { day: string; start: string; end: string }, idx: number) => {
              const dateStr = getSlotDateISO(slot.day, slot.start);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-blue-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{slot.day}</p>
                    <p className="text-sm text-gray-500">
                      {slot.start} - {slot.end}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      Próximo: {new Date(dateStr).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBook(doctor.userId, dateStr)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
                  >
                    Agendar
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
