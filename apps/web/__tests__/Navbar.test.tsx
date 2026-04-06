import { render, screen, waitFor } from '@testing-library/react';
import Navbar from '../src/components/Navbar';

/** JWT mínimo válido para o Navbar (apenas payload é lido). */
function makeFakeJwt(role: 'DOCTOR' | 'PATIENT'): string {
  const payload = btoa(JSON.stringify({ sub: 1, role, email: 't@test.com' }));
  return `h.${payload}.s`;
}

describe('Navbar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mostra links Dashboard e Agenda para médico logado', async () => {
    localStorage.setItem('token', makeFakeJwt('DOCTOR'));
    render(<Navbar />);

    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      const agendaLink = screen.getByRole('link', { name: /agenda/i });
      expect(dashboardLink.getAttribute('href')).toBe('/dashboard/doctor');
      expect(agendaLink.getAttribute('href')).toBe('/agenda');
    });
  });

  it('não mostra links de médico para paciente e mantém Agendar', async () => {
    localStorage.setItem('token', makeFakeJwt('PATIENT'));
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /agendar/i })).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: /^Dashboard$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Agenda$/i })).toBeNull();
  });
});
