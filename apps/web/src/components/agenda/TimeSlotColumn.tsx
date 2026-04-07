interface Props {
  slots: string[];
}

/**
 * Coluna lateral esquerda do grid semanal com os horários em 15min.
 * Mostra só horas cheias (08:00, 09:00, ...) para reduzir ruído.
 */
export function TimeSlotColumn({ slots }: Props) {
  return (
    <div className="col-span-1 border-r border-slate-100 bg-slate-50/30">
      {slots.map((time) => (
        <div
          key={time}
          className="h-4 border-b border-slate-100/50 p-1 pr-4 text-right text-[10px] font-medium text-slate-400"
        >
          {time.endsWith(':00') ? time : ''}
        </div>
      ))}
    </div>
  );
}
