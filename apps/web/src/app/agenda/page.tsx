'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Clock, Loader2, Trash2, FileText, Pill } from 'lucide-react';
import { AgendaHeader } from '@/components/agenda/AgendaHeader';
import { CalendarToolbar } from '@/components/agenda/CalendarToolbar';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import {
  getProfileMeSafe,
  saveDoctorAvailability,
  fetchAppointmentsMe,
} from '@/lib/doctor-dashboard-api';
import { useGridSelection } from '@/hooks/useGridSelection';
import { doesSlotApplyToDate, mergeSlots, type Slot, TIME_SLOTS } from '@/lib/slot-utils';
import { parseISO, addMinutes } from 'date-fns';
import { AvailabilityModal } from '@/components/AvailabilityModal';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { ConsultationModelsManager } from '@/components/ConsultationModelsManager';
import { MedicalRecordModal } from '@/components/MedicalRecordModal';
import { PrescriptionModal } from '@/components/PrescriptionModal';

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const SLOT_HEIGHT = 16; // px per 15 min slot (so 1 hour = 64px)

export default function DoctorAgenda() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [baseDate, setBaseDate] = useState(new Date());

  const [initialModalData, setInitialModalData] = useState<{
    date: string;
    start: string;
    end: string;
    recurrence: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
    isRecurrenceChecked: boolean;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    start: '08:00',
    end: '09:00',
    recurrence: 'NONE',
    isRecurrenceChecked: false,
  });

  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<{ id: number; targetDate: string } | null>(null);

  const [isMedicalRecordOpen, setIsMedicalRecordOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [selectedPatientForRecord, setSelectedPatientForRecord] = useState<{
    id: number;
    name: string;
    appointmentId?: number;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [consultationModels, setConsultationModels] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile && scrollContainerRef.current) {
      // Scroll para 08:00 após carregar o perfil e renderizar a grade
      // 8 horas * 4 slots/hora * 16px/slot = 512px
      scrollContainerRef.current.scrollTop = 8 * 4 * SLOT_HEIGHT;
    }
  }, [profile]);

  const navigateToday = () => {
    setBaseDate(new Date());
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 8 * 4 * SLOT_HEIGHT;
    }
  };

  // Pega os 7 dias da semana atual
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 }); // Domingo como dia 0
  const currentWeekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const navigatePrev = () => setBaseDate((prev) => subWeeks(prev, 1));
  const navigateNext = () => setBaseDate((prev) => addWeeks(prev, 1));

  const onSelectRange = useCallback((isoDateString: string, start: string, end: string) => {
    setEditingSlotId(null);
    const endIdx = TIME_SLOTS.indexOf(end);
    const nextIdx = endIdx + 1;
    const endStr = TIME_SLOTS[nextIdx] || '22:00';

    setInitialModalData({
      date: isoDateString,
      start,
      end: endStr,
      recurrence: 'NONE',
      isRecurrenceChecked: false,
    });
    setIsModalOpen(true);
  }, []);

  const { selection, handleMouseDown, handleMouseEnter, handleMouseUp } =
    useGridSelection(onSelectRange);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadError(null);
      try {
        const profResult = (await getProfileMeSafe()) as any;
        if (cancelled) return;
        if (profResult.notFound) {
          window.location.href = '/setup/doctor';
          return;
        }

        const prof = profResult.profile as Record<string, unknown> & {
          availability?: string | null;
          consultationModels?: any[];
        };
        setProfile(prof);
        setConsultationModels(prof.consultationModels || []);

        try {
          setAvailability(mergeSlots(JSON.parse(prof?.availability || '[]') as Slot[]));
        } catch {
          setAvailability([]);
        }

        // Carrega consultas confirmadas
        try {
          const appts = (await fetchAppointmentsMe()) as any[];
          if (!cancelled) {
            setAppointments(appts || []);
          }
        } catch (err) {
          console.error('Erro ao carregar consultas:', err);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'Não foi possível carregar a agenda. Verifique sua conexão e tente novamente.',
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEditSlot = (slot: Slot, targetDate: string) => {
    setEditingSlotId(slot.id);
    setInitialModalData({
      date: targetDate,
      start: slot.start,
      end: slot.end,
      recurrence: slot.recurrence || 'WEEKLY',
      isRecurrenceChecked: !!slot.recurrence && slot.recurrence !== 'NONE',
    });
    setIsModalOpen(true);
  };

  const addSlot = async (data: {
    date: string;
    start: string;
    end: string;
    recurrence: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
    isRecurrenceChecked: boolean;
  }) => {
    let updated;
    const finalRecurrence = data.isRecurrenceChecked ? data.recurrence : 'NONE';

    const dateObj = new Date(`${data.date}T12:00:00Z`);
    const dayOfWeekStr = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][
      dateObj.getDay()
    ];

    if (editingSlotId) {
      updated = availability.map((s) =>
        s.id === editingSlotId
          ? {
              ...s,
              date: data.date,
              day: dayOfWeekStr,
              start: data.start,
              end: data.end,
              recurrence: finalRecurrence,
            }
          : s,
      );
    } else {
      updated = [
        ...availability,
        {
          id: Date.now(),
          date: data.date,
          day: dayOfWeekStr,
          start: data.start,
          end: data.end,
          recurrence: finalRecurrence,
        },
      ];
    }
    setIsSaving(true);
    try {
      const merged = mergeSlots(updated);
      setAvailability(merged);
      await persistAvailability(merged);
      setIsModalOpen(false);
      setEditingSlotId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const removeSlot = async (id: number) => {
    const updated = availability.filter((s) => s.id !== id);
    setAvailability(updated);
    await persistAvailability(updated);
    setIsDeleteConfirmOpen(false);
    setSlotToDelete(null);
  };

  const removeOnlyThisOccurrence = async (id: number, targetDateStr: string) => {
    const slot = availability.find((s) => s.id === id);
    if (!slot) return;

    let newSlots: Slot[] = [];
    const rest = availability.filter((s) => s.id !== id);

    if (slot.recurrence === 'DAILY') {
      const dates = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
      newSlots = dates
        .map((d) => format(d, 'yyyy-MM-dd'))
        .filter((dStr) => dStr !== targetDateStr)
        .map((dStr, index) => ({
          ...slot,
          id: Date.now() + index,
          date: dStr,
          recurrence: 'NONE' as const,
        }));
    } else if (slot.recurrence === 'WEEKDAYS') {
      const dates = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i + 1));
      newSlots = dates
        .map((d) => format(d, 'yyyy-MM-dd'))
        .filter((dStr) => dStr !== targetDateStr)
        .map((dStr, index) => ({
          ...slot,
          id: Date.now() + index,
          date: dStr,
          recurrence: 'NONE' as const,
        }));
    }

    const updated = [...rest, ...newSlots];
    setAvailability(updated);
    await persistAvailability(updated);
    setIsDeleteConfirmOpen(false);
    setSlotToDelete(null);
  };

  const persistAvailability = async (data: Slot[]) => {
    try {
      await saveDoctorAvailability(JSON.stringify(data));
    } catch {
      setLoadError('Não foi possível salvar a disponibilidade.');
    }
  };

  const selectionBox = useMemo(() => {
    if (!selection) return null;
    const startIdx = TIME_SLOTS.indexOf(selection.start);
    const endIdx = TIME_SLOTS.indexOf(selection.end);
    if (startIdx === -1 || endIdx === -1) return null;

    const topIdx = Math.min(startIdx, endIdx);
    const bottomIdx = Math.max(startIdx, endIdx);
    const top = topIdx * SLOT_HEIGHT;
    const height = (bottomIdx - topIdx + 1) * SLOT_HEIGHT - 4;

    return { top, height, day: selection.day };
  }, [selection]);

  if (!profile && !loadError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600" aria-hidden />
        <p className="text-sm font-medium">Carregando agenda…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {loadError ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          {loadError}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-8">
        <AgendaHeader />

        {profile && (
          <ConsultationModelsManager
            initialModels={consultationModels}
            onModelsChange={setConsultationModels}
          />
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CalendarToolbar
            baseDate={baseDate}
            onPrev={navigatePrev}
            onNext={navigateNext}
            onToday={navigateToday}
            onNewSlot={() => {
              setEditingSlotId(null);
              setInitialModalData({
                date: format(new Date(), 'yyyy-MM-dd'),
                start: '08:00',
                end: '09:00',
                recurrence: 'NONE',
                isRecurrenceChecked: false,
              });
              setIsModalOpen(true);
            }}
          />

          <div className="overflow-x-auto">
            <div
              ref={scrollContainerRef}
              className="relative max-h-[700px] min-w-[600px] overflow-y-auto select-none border-t border-slate-100"
              onMouseLeave={handleMouseUp}
            >
              {/* Header de dias (Sticky) */}
              <div className="sticky top-0 z-50 grid grid-cols-8 border-b border-slate-100 bg-white shadow-sm">
                <div className="border-r border-slate-100 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                  Hora
                </div>
                {currentWeekDays.map((date) => {
                  const isToday = isSameDay(date, new Date());
                  const dayName = format(date, 'EEEE', { locale: ptBR });
                  const dayNum = format(date, 'd');

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border-r border-slate-100 p-4 text-center transition ${isToday ? 'bg-sky-50/50' : 'bg-slate-50'}`}
                    >
                      <div
                        className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-sky-600' : 'text-slate-500'}`}
                      >
                        {dayName.split('-')[0].substring(0, 3)}
                      </div>
                      <div
                        className={`mt-1 text-xl font-bold ${isToday ? 'text-sky-600' : 'text-slate-900'}`}
                      >
                        {dayNum}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body */}
              <div className="relative grid grid-cols-8">
                <div className="col-span-1 border-r border-slate-100 bg-slate-50/30">
                  {TIME_SLOTS.map((time) => (
                    <div
                      key={time}
                      className="h-4 border-b border-slate-100/50 p-1 pr-4 text-right text-[10px] font-medium text-slate-400"
                    >
                      {time.endsWith(':00') ? time : ''}
                    </div>
                  ))}
                </div>

                {currentWeekDays.map((date) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isToday = isSameDay(date, new Date());

                  // Cálculo da linha "Agora"
                  let nowTop = -1;
                  if (isToday) {
                    const hours = currentTime.getHours();
                    const minutes = currentTime.getMinutes();
                    const totalMinutes = hours * 60 + minutes;
                    nowTop = (totalMinutes / 15) * SLOT_HEIGHT;
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`group relative col-span-1 border-r border-slate-100 ${isToday ? 'bg-sky-50/10' : ''}`}
                      onMouseUp={handleMouseUp}
                    >
                      {isToday && nowTop >= 0 && (
                        <div
                          className="absolute left-0 right-0 z-40 flex items-center pointer-events-none"
                          style={{ top: `${nowTop}px` }}
                        >
                          <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
                          <div className="h-[1px] flex-1 bg-red-500 shadow-sm" />
                        </div>
                      )}

                      {TIME_SLOTS.map((time) => {
                        const hour = parseInt(time.split(':')[0]);
                        const isBusinessHour = hour >= 8 && hour < 19;

                        return (
                          <div
                            key={time}
                            onMouseDown={() => handleMouseDown(dateStr, time)}
                            onMouseEnter={() => handleMouseEnter(dateStr, time)}
                            className={`h-4 w-full border-b transition-colors hover:bg-sky-50/40 cursor-crosshair ${
                              time.endsWith(':00') ? 'border-slate-100' : 'border-slate-50'
                            } ${!isBusinessHour ? 'bg-slate-50/20' : ''}`}
                            role="button"
                            aria-label={`Selecionar horário ${format(date, 'dd/MM')} ${time}`}
                          />
                        );
                      })}

                      {selectionBox?.day === dateStr && (
                        <div
                          className="absolute left-1 right-1 pointer-events-none rounded border-2 border-dashed border-sky-400 bg-sky-100/60 z-10 transition-all duration-75"
                          style={{
                            top: `${selectionBox.top}px`,
                            height: `${selectionBox.height}px`,
                          }}
                        />
                      )}

                      {availability
                        .filter((slot) => doesSlotApplyToDate(slot, date))
                        .map((slot) => {
                          const startIdx = TIME_SLOTS.indexOf(slot.start);
                          const endIdx = TIME_SLOTS.indexOf(slot.end);
                          if (startIdx === -1) return null;

                          const top = startIdx * SLOT_HEIGHT;
                          const height = Math.max(
                            SLOT_HEIGHT - 4,
                            (endIdx - startIdx) * SLOT_HEIGHT - 4,
                          );

                          return (
                            <div
                              key={`${slot.id}-${dateStr}`}
                              onClick={() => handleEditSlot(slot, dateStr)}
                              onKeyDown={(e) => e.key === 'Enter' && handleEditSlot(slot, dateStr)}
                              className="group/slot absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md border border-sky-200 bg-sky-100/90 p-1.5 shadow-sm z-20 hover:bg-sky-200/90 transition-all hover:shadow-md ring-1 ring-inset ring-sky-300/30"
                              style={{
                                top: `${top + 1}px`,
                                height: `${height}px`,
                                borderLeftWidth: '4px',
                                borderLeftColor: '#0284c7', // sky-600
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Editar disponibilidade ${format(date, 'dd/MM')} ${slot.start}-${slot.end}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[9px] font-bold leading-none text-sky-900 truncate">
                                  Disponível
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isRecurring =
                                      !!slot.recurrence && slot.recurrence !== 'NONE';
                                    if (isRecurring) {
                                      setSlotToDelete({ id: slot.id, targetDate: dateStr });
                                      setIsDeleteConfirmOpen(true);
                                    } else {
                                      void removeSlot(slot.id);
                                    }
                                  }}
                                  className="text-sky-800 opacity-0 transition hover:text-red-600 group-hover/slot:opacity-100"
                                  aria-label="Remover slot"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                              <p className="mt-0.5 text-[9px] font-medium text-sky-700 leading-none">
                                {slot.start} - {slot.end}
                                {slot.recurrence && slot.recurrence !== 'NONE' ? ' 🔄' : ''}
                              </p>
                            </div>
                          );
                        })}

                      {appointments
                        .filter((appt) => isSameDay(parseISO(appt.date), date))
                        .map((appt) => {
                          const start = parseISO(appt.date);
                          const end = addMinutes(start, appt.durationMinutes);

                          const startStr = format(start, 'HH:mm');
                          const endStr = format(end, 'HH:mm');

                          // Cálculo robusto de posição baseado em minutos do dia
                          const startTotalMinutes = start.getHours() * 60 + start.getMinutes();
                          const top = (startTotalMinutes / 15) * SLOT_HEIGHT;

                          const durationSlots = appt.durationMinutes / 15;
                          const height = durationSlots * SLOT_HEIGHT - 4;

                          return (
                            <div
                              key={`appt-${appt.id}`}
                              onClick={() => {
                                setSelectedPatientForRecord({
                                  id: appt.patientId,
                                  name: appt.patient?.name || 'Paciente',
                                  appointmentId: appt.id,
                                });
                                setIsMedicalRecordOpen(true);
                              }}
                              className="absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-emerald-200 bg-emerald-100/90 p-1.5 shadow-sm z-30 ring-1 ring-inset ring-emerald-300/30 cursor-pointer hover:bg-emerald-200/90 transition-all"
                              style={{
                                top: `${top + 1}px`,
                                height: `${height}px`,
                                borderLeftWidth: '4px',
                                borderLeftColor: '#059669', // emerald-600
                              }}
                              title={`Consulta: ${appt.patient?.name || 'Paciente'} (Clique para abrir prontuário)`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[9px] font-bold leading-none text-emerald-900 truncate">
                                  {appt.patient?.name || 'Consulta'}
                                </p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatientForRecord({
                                        id: appt.patientId,
                                        name: appt.patient?.name || 'Paciente',
                                        appointmentId: appt.id,
                                      });
                                      setIsMedicalRecordOpen(true);
                                    }}
                                    className="p-0.5 hover:bg-emerald-200 rounded text-emerald-700"
                                    title="Abrir Prontuário"
                                  >
                                    <FileText size={10} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPatientForRecord({
                                        id: appt.patientId,
                                        name: appt.patient?.name || 'Paciente',
                                        appointmentId: appt.id,
                                      });
                                      setIsPrescriptionOpen(true);
                                    }}
                                    className="p-0.5 hover:bg-emerald-200 rounded text-emerald-700"
                                    title="Emitir Receita"
                                  >
                                    <Pill size={10} />
                                  </button>
                                </div>
                              </div>
                              <p className="mt-0.5 text-[9px] font-medium text-emerald-700 leading-none">
                                {startStr} - {endStr}
                              </p>
                              {height > 30 && (
                                <p className="mt-1 text-[8px] font-bold text-emerald-600/80 uppercase tracking-tight">
                                  Consulta
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AvailabilityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSlotId(null);
        }}
        onConfirm={addSlot}
        isLoading={isSaving}
        initialData={initialModalData}
        isEditing={!!editingSlotId}
      />

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setSlotToDelete(null);
        }}
        onRemoveOnlyThis={() => {
          if (slotToDelete) {
            void removeOnlyThisOccurrence(slotToDelete.id, slotToDelete.targetDate);
          }
        }}
        onRemoveAll={() => {
          if (slotToDelete) {
            void removeSlot(slotToDelete.id);
          }
        }}
      />

      {selectedPatientForRecord && (
        <>
          <MedicalRecordModal
            isOpen={isMedicalRecordOpen}
            onClose={() => {
              setIsMedicalRecordOpen(false);
              if (!isPrescriptionOpen) setSelectedPatientForRecord(null);
            }}
            patientId={selectedPatientForRecord.id}
            patientName={selectedPatientForRecord.name}
            appointmentId={selectedPatientForRecord.appointmentId}
          />
          <PrescriptionModal
            isOpen={isPrescriptionOpen}
            onClose={() => {
              setIsPrescriptionOpen(false);
              if (!isMedicalRecordOpen) setSelectedPatientForRecord(null);
            }}
            patientId={selectedPatientForRecord.id}
            patientName={selectedPatientForRecord.name}
            appointmentId={selectedPatientForRecord.appointmentId}
          />
        </>
      )}
    </div>
  );
}
