import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LacunaSignatureCallback from '../page';
import * as api from '@/lib/doctor-dashboard-api';

// Router e useSearchParams do Next precisam ser mockados
const mockReplace = jest.fn();
const searchParamsMock: Record<string, string | null> = {};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => searchParamsMock[key] ?? null,
  }),
}));

jest.mock('@/lib/doctor-dashboard-api');
const mocked = api as jest.Mocked<typeof api>;

describe('LacunaSignatureCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(searchParamsMock).forEach((k) => delete searchParamsMock[k]);
    localStorage.clear();
  });

  it('exibe erro quando o provider devolve access_denied', async () => {
    searchParamsMock.error = 'access_denied';

    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(screen.getByText(/Acesso negado pelo usuário/i)).toBeInTheDocument();
    });
    expect(mocked.signMedicalRecord).not.toHaveBeenCalled();
  });

  it('exibe erro quando falta o código de autorização', async () => {
    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(screen.getByText(/Código de autorização não encontrado/i)).toBeInTheDocument();
    });
  });

  it('exibe erro quando não consegue identificar o recordId', async () => {
    searchParamsMock.code = 'lacuna-code-123';

    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(screen.getByText(/Identificação do documento não encontrada/i)).toBeInTheDocument();
    });
  });

  it('chama signMedicalRecord quando recordId vem do state', async () => {
    searchParamsMock.code = 'lacuna-code-123';
    searchParamsMock.state = encodeURIComponent(
      JSON.stringify({ recordId: 42, type: 'medical-record' }),
    );
    mocked.signMedicalRecord.mockResolvedValue({
      id: 42,
      status: 'SIGNED',
    } as any);

    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(mocked.signMedicalRecord).toHaveBeenCalledWith(42, { code: 'lacuna-code-123' });
    });
  });

  it('chama signPrescription quando state indica type=prescription', async () => {
    searchParamsMock.code = 'lacuna-code-xyz';
    searchParamsMock.state = encodeURIComponent(
      JSON.stringify({ recordId: 99, type: 'prescription' }),
    );
    mocked.signPrescription.mockResolvedValue({ id: 99, status: 'SIGNED' } as any);

    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(mocked.signPrescription).toHaveBeenCalledWith(99, { code: 'lacuna-code-xyz' });
    });
  });

  it('faz fallback para localStorage quando state ausente', async () => {
    searchParamsMock.code = 'abc';
    localStorage.setItem('pending_signature_record_id', '7');
    localStorage.setItem('pending_signature_type', 'medical-record');

    mocked.signMedicalRecord.mockResolvedValue({ id: 7, status: 'SIGNED' } as any);

    render(<LacunaSignatureCallback />);

    await waitFor(() => {
      expect(mocked.signMedicalRecord).toHaveBeenCalledWith(7, { code: 'abc' });
    });
  });
});
