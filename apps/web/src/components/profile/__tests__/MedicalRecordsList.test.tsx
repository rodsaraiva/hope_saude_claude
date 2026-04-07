import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MedicalRecordsList } from '../MedicalRecordsList';
import type { MedicalRecord } from '@/lib/doctor-dashboard-api';

const buildRecord = (overrides: Partial<MedicalRecord> = {}): MedicalRecord => ({
  id: 1,
  patientId: 10,
  doctorId: 5,
  content: '<p>Paciente evoluindo bem</p>',
  status: 'DRAFT',
  type: 'EVOLUTION',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  doctor: { name: 'Ana Silva' },
  ...overrides,
});

describe('MedicalRecordsList', () => {
  it('exibe placeholder quando não há prontuários', () => {
    render(<MedicalRecordsList records={[]} />);
    expect(screen.getByText(/Nenhuma evolução registrada/i)).toBeInTheDocument();
  });

  it('renderiza conteúdo HTML do prontuário (dangerouslySetInnerHTML)', () => {
    render(<MedicalRecordsList records={[buildRecord()]} />);
    expect(screen.getByText(/Paciente evoluindo bem/)).toBeInTheDocument();
  });

  it('mostra nome do médico do campo doctor.name', () => {
    render(<MedicalRecordsList records={[buildRecord()]} />);
    expect(screen.getByText(/Dr\. Ana Silva/)).toBeInTheDocument();
  });

  it('fallback para "Médico" quando doctor.name ausente', () => {
    render(<MedicalRecordsList records={[buildRecord({ doctor: undefined })]} />);
    expect(screen.getByText(/Dr\. Médico/)).toBeInTheDocument();
  });

  it('exibe selo ASSINADO DIGITALMENTE com hash quando status=SIGNED', () => {
    render(
      <MedicalRecordsList
        records={[
          buildRecord({
            status: 'SIGNED',
            signedHash: 'abc-hash',
            signatureDate: '2026-04-02T15:30:00.000Z',
          }),
        ]}
      />,
    );
    expect(screen.getByText(/ASSINADO DIGITALMENTE/i)).toBeInTheDocument();
    expect(screen.getByText(/Hash de Integridade: abc-hash/)).toBeInTheDocument();
  });

  it('mostra aviso de privacidade (LGPD) no rodapé', () => {
    render(<MedicalRecordsList records={[]} />);
    expect(
      screen.getByText(/Apenas você e os médicos com quem você tem consulta/i),
    ).toBeInTheDocument();
  });

  it('lista múltiplos prontuários', () => {
    render(
      <MedicalRecordsList
        records={[
          buildRecord({ id: 1, content: '<p>Primeiro</p>' }),
          buildRecord({ id: 2, content: '<p>Segundo</p>' }),
        ]}
      />,
    );
    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });
});
