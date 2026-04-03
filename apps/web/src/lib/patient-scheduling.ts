const daysMap: Record<string, number> = {
  Domingo: 0,
  Segunda: 1,
  Terça: 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  Sábado: 6,
};

/** Próxima ocorrência do dia da semana + hora, em ISO (agendamento). */
export function getSlotDateISO(dayName: string, time: string): string {
  const targetDay = daysMap[dayName];
  if (targetDay === undefined) return new Date().toISOString();

  const today = new Date();
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  const [hours, minutes] = time.split(':').map(Number);
  targetDate.setHours(hours, minutes || 0, 0, 0);
  return targetDate.toISOString();
}
