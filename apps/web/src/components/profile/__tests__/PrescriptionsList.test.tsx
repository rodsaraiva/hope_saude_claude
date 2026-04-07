import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PrescriptionsList } from '../PrescriptionsList';

const baseMedications = JSON.stringify([
  { name: 'Sertralina', dosage: '50mg', frequency: '1x ao dia', instructions: 'Pela manhã' },
]);

const buildPrescription = (overrides = {}) => ({
  id: 1,
  patientId: 10,
  doctorId: 5,
  medications: baseMedications,
  status: 'DRAFT' as const,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  ...overrides,
});

describe('PrescriptionsList', () => {
  it('exibe placeholder quando não há receitas', () => {
    render(<PrescriptionsList prescriptions={[]} doctorNames={{}} />);
    expect(screen.getByText(/Nenhuma receita encontrada/i)).toBeInTheDocument();
  });

  it('renderiza medicação com nome, dosagem e frequência', () => {
    render(<PrescriptionsList prescriptions={[buildPrescription()]} doctorNames={{ 5: 'Ana' }} />);
    expect(screen.getByText(/Sertralina - 50mg/)).toBeInTheDocument();
    expect(screen.getByText(/1x ao dia/)).toBeInTheDocument();
    expect(screen.getByText(/Pela manhã/)).toBeInTheDocument();
  });

  it('mostra nome do médico via doctorNames lookup', () => {
    render(
      <PrescriptionsList prescriptions={[buildPrescription()]} doctorNames={{ 5: 'Carlos' }} />,
    );
    expect(screen.getByText(/Dr\. Carlos/)).toBeInTheDocument();
  });

  it('mostra fallback "Médico" quando doctorId não está no map', () => {
    render(<PrescriptionsList prescriptions={[buildPrescription()]} doctorNames={{}} />);
    expect(screen.getByText(/Dr\. Médico/)).toBeInTheDocument();
  });

  it('exibe selo ASSINADA DIGITALMENTE quando status é SIGNED', () => {
    render(
      <PrescriptionsList
        prescriptions={[
          buildPrescription({
            status: 'SIGNED',
            signedHash: 'abc123',
            signatureDate: '2026-04-02T15:30:00.000Z',
          }),
        ]}
        doctorNames={{ 5: 'Ana' }}
      />,
    );
    expect(screen.getByText(/ASSINADA DIGITALMENTE/i)).toBeInTheDocument();
    expect(screen.getByText(/Hash de Verificação: abc123/)).toBeInTheDocument();
  });

  it('botão IMPRIMIR só aparece quando onPrint é fornecido', async () => {
    const onPrint = jest.fn();
    render(
      <PrescriptionsList
        prescriptions={[buildPrescription()]}
        doctorNames={{}}
        onPrint={onPrint}
      />,
    );
    const btn = screen.getByRole('button', { name: /IMPRIMIR/i });
    await userEvent.click(btn);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('não quebra com JSON inválido em medications (parsing tolerante)', () => {
    render(
      <PrescriptionsList
        prescriptions={[buildPrescription({ medications: 'not-json' })]}
        doctorNames={{}}
      />,
    );
    // Componente renderiza o card, só sem medications
    expect(screen.getByText(/Dr\. Médico/)).toBeInTheDocument();
  });
});
