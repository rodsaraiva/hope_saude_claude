import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RegistrationDetails } from '../RegistrationDetails';

describe('RegistrationDetails', () => {
  const base = {
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    missingExtendedProfile: false,
  };

  it('renderiza e-mail e nome para qualquer role', () => {
    render(<RegistrationDetails {...base} userRole="PATIENT" />);
    expect(screen.getByText('maria@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  });

  it('PATIENT: mostra telefone e histórico clínico', () => {
    render(
      <RegistrationDetails
        {...base}
        userRole="PATIENT"
        phone="11999999999"
        medicalHistory="Ansiedade"
      />,
    );
    expect(screen.getByText('11999999999')).toBeInTheDocument();
    expect(screen.getByText('Ansiedade')).toBeInTheDocument();
    expect(screen.queryByText(/Especialidade/i)).not.toBeInTheDocument();
  });

  it('PATIENT: placeholder quando profile estendido faltante', () => {
    render(<RegistrationDetails {...base} userRole="PATIENT" missingExtendedProfile />);
    // "—" aparece para telefone e histórico
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('DOCTOR: mostra especialidade, CRM e bio (quando presentes)', () => {
    render(
      <RegistrationDetails
        {...base}
        userRole="DOCTOR"
        specialty="Psiquiatria"
        crm="123456-SP"
        bio="10 anos de experiência em ansiedade"
      />,
    );
    expect(screen.getByText('Psiquiatria')).toBeInTheDocument();
    expect(screen.getByText('123456-SP')).toBeInTheDocument();
    expect(screen.getByText('10 anos de experiência em ansiedade')).toBeInTheDocument();
    expect(screen.queryByText(/Histórico clínico/i)).not.toBeInTheDocument();
  });

  it('DOCTOR: bio opcional não aparece quando ausente', () => {
    render(<RegistrationDetails {...base} userRole="DOCTOR" specialty="Psiquiatria" crm="X" />);
    expect(screen.queryByText(/Biografia/i)).not.toBeInTheDocument();
  });
});
