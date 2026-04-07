import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileSidebar } from '../ProfileSidebar';

// ProfileAvatar lê localStorage / canvas — mock leve para isolar o teste do sidebar.
jest.mock('@/components/ProfileAvatar', () => ({
  __esModule: true,
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="mock-avatar">{displayName}</div>
  ),
}));

describe('ProfileSidebar', () => {
  it('renderiza nome e role label', () => {
    render(<ProfileSidebar userId={1} displayName="Dr. Ana" roleLabel="Médico" />);
    // Ambos avatar mock e <p> contêm o nome — basta confirmar que aparece
    expect(screen.getAllByText('Dr. Ana').length).toBeGreaterThan(0);
    expect(screen.getByText('Médico')).toBeInTheDocument();
  });

  it('passa displayName para o ProfileAvatar', () => {
    render(<ProfileSidebar userId={1} displayName="Dr. Ana" roleLabel="Médico" />);
    expect(screen.getByTestId('mock-avatar')).toHaveTextContent('Dr. Ana');
  });

  it('aceita userId nulo sem crashar', () => {
    render(<ProfileSidebar userId={null} displayName="Anônimo" roleLabel="Visitante" />);
    expect(screen.getAllByText('Anônimo').length).toBeGreaterThan(0);
    expect(screen.getByText('Visitante')).toBeInTheDocument();
  });
});
