export function splitAppointmentsByDate<T extends { date: string }>(appointments: T[]): {
  upcoming: T[];
  history: T[];
} {
  const now = Date.now();
  const upcoming: T[] = [];
  const history: T[] = [];
  for (const a of appointments) {
    const t = new Date(a.date).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= now) upcoming.push(a);
    else history.push(a);
  }
  upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { upcoming, history };
}
