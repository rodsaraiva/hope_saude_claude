/**
 * Cabeçalho estático da página de agenda — sem state, sem efeitos.
 * Server Component compatível.
 */
export function AgendaHeader() {
  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-sky-600">Área do especialista</p>
      <h1 className="text-2xl font-bold text-slate-900">Agenda de Disponibilidade</h1>
      <p className="mt-1 text-slate-600">
        Configure os horários em que você está disponível para atendimentos e gerencie seus modelos
        de consulta.
      </p>
    </header>
  );
}
