import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MedicalRecordModal } from '../MedicalRecordModal';

jest.mock('@/lib/doctor-dashboard-api', () => ({
  fetchMedicalRecords: jest.fn().mockResolvedValue([
    {
      id: 42,
      patientId: 10,
      doctorId: 5,
      appointmentId: 7,
      content: '<p>PHI sensível do paciente</p>',
      status: 'DRAFT',
      type: 'EVOLUTION',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ]),
  createMedicalRecord: jest.fn(),
  updateMedicalRecord: jest.fn(),
  signMedicalRecord: jest.fn(),
  getLacunaAuthorizeUrl: jest.fn().mockReturnValue('https://pki.rest/authorize'),
}));

jest.mock('../RichTextEditor', () => ({
  RichTextEditor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>,
}));

describe('MedicalRecordModal — assinatura não grava PHI no localStorage', () => {
  const originalConfirm = window.confirm;
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    window.confirm = jest.fn().mockReturnValue(true);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('grava só o record_id e NÃO o conteúdo clínico ao assinar', async () => {
    render(
      <MedicalRecordModal
        isOpen
        onClose={() => {}}
        patientId={10}
        patientName="Maria"
        appointmentId={7}
      />,
    );

    const signBtn = await screen.findByText(/Assinar Digitalmente/i);
    fireEvent.click(signBtn);

    expect(localStorage.getItem('pending_signature_record_id')).toBe('42');
    expect(localStorage.getItem('pending_signature_content')).toBeNull();
  });
});
