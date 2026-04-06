import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DoctorAgenda from '../src/app/agenda/page';
import { getProfileMeSafe, saveDoctorAvailability } from '../src/lib/doctor-dashboard-api';

jest.mock('../src/lib/doctor-dashboard-api', () => ({
  getProfileMeSafe: jest.fn(),
  fetchAppointmentsMe: jest.fn(),
  saveDoctorAvailability: jest.fn(),
}));

// Mock useGridSelection to avoid dragging complexity in this test
jest.mock('../src/hooks/useGridSelection', () => ({
  useGridSelection: () => ({
    selection: null,
    handleMouseDown: jest.fn(),
    handleMouseEnter: jest.fn(),
    handleMouseUp: jest.fn(),
  }),
}));

describe('DoctorAgenda - Availability management', () => {
  const mockProfile = {
    profile: {
      user: { name: 'João' },
      availability: JSON.stringify([
        { day: 'Segunda', start: '09:00', end: '10:00', id: 123 }
      ]),
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getProfileMeSafe as jest.Mock).mockResolvedValue(mockProfile);
  });

  it('deve abrir o modal de edição ao clicar em um slot existente', async () => {
    render(<DoctorAgenda />);

    // Espera carregar
    await waitFor(() => expect(screen.getByText('Agenda de Disponibilidade')).toBeInTheDocument());

    // Encontra o slot de disponibilidade
    const slot = screen.getByText('09:00 - 10:00');
    fireEvent.click(slot);

    // Verifica se o modal abriu com o título correto e valores preenchidos
    expect(screen.getByText('Editar Disponibilidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Data')).toBeInTheDocument();
    expect(screen.getByLabelText('Início')).toHaveValue('09:00');
    expect(screen.getByLabelText('Fim')).toHaveValue('10:00');
    
    // O botão deve dizer "Atualizar"
    expect(screen.getByText('Atualizar')).toBeInTheDocument();
  });

  it('deve atualizar o slot ao clicar em "Atualizar"', async () => {
    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getByText('Agenda de Disponibilidade')).toBeInTheDocument());

    const slot = screen.getByText('09:00 - 10:00');
    fireEvent.click(slot);

    // Altera o horário no modal
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '11:00' } });
    
    // Clica em atualizar
    fireEvent.click(screen.getByText('Atualizar'));

    // Verifica se saveDoctorAvailability foi chamado com os dados corretos
    await waitFor(() => {
      expect(saveDoctorAvailability).toHaveBeenCalledWith(
        expect.stringContaining('"id":123')
      );
      expect(saveDoctorAvailability).toHaveBeenCalledWith(
        expect.stringContaining('"end":"11:00"')
      );
    });
  });

  it('deve permitir ativar e alterar a recorrência no modal de edição', async () => {
    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getByText('Agenda de Disponibilidade')).toBeInTheDocument());

    const slot = screen.getByText('09:00 - 10:00');
    fireEvent.click(slot);

    // Inicialmente o select de recorrência não deve estar visível (apenas o checkbox)
    expect(screen.queryByLabelText('Frequência da repetição')).not.toBeInTheDocument();
    
    // Ativa a recorrência
    const recurrenceCheck = screen.getByText('Repetir este horário');
    fireEvent.click(recurrenceCheck);

    // Agora o select deve aparecer
    const recurrenceSelect = screen.getByLabelText('Frequência');
    expect(recurrenceSelect).toBeInTheDocument();
    expect(recurrenceSelect).toHaveValue('WEEKLY');
    
    fireEvent.change(recurrenceSelect, { target: { value: 'DAILY' } });
    
    // Clica em atualizar
    fireEvent.click(screen.getByText('Atualizar'));

    // Verifica se saveDoctorAvailability foi chamado com DAILY
    await waitFor(() => {
      expect(saveDoctorAvailability).toHaveBeenCalledWith(
        expect.stringContaining('"recurrence":"DAILY"')
      );
    });
  });

  it('deve exibir erro se a hora de fim for antes ou igual a de início', async () => {
    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getByText('Agenda de Disponibilidade')).toBeInTheDocument());

    const slot = screen.getByText('09:00 - 10:00');
    fireEvent.click(slot);

    // Altera o horário de fim para ser igual ao de início
    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '09:00' } });
    
    // Clica em atualizar
    fireEvent.click(screen.getByText('Atualizar'));

    // Verifica se a mensagem de erro aparece
    expect(screen.getByText('A hora de fim deve ser após a hora de início')).toBeInTheDocument();
    
    // Verifica que a API NÃO foi chamada
    expect(saveDoctorAvailability).not.toHaveBeenCalled();
  });

  it('deve abrir modal de confirmação ao tentar excluir um slot recorrente', async () => {
    const recurringProfile = {
      profile: {
        user: { name: 'João' },
        availability: JSON.stringify([
          { day: 'Segunda', start: '09:00', end: '10:00', id: 456, recurrence: 'DAILY' }
        ]),
      }
    };
    (getProfileMeSafe as jest.Mock).mockResolvedValue(recurringProfile);

    render(<DoctorAgenda />);
    // Usa regex para ignorar o emoji de recorrência no texto
    // Como é DAILY, vai aparecer em todos os 7 dias
    await waitFor(() => expect(screen.getAllByText(/09:00 - 10:00/)).toHaveLength(7));

    // Pegamos o botão de remover do primeiro dia (Segunda)
    const deleteButtons = screen.getAllByLabelText('Remover slot');
    fireEvent.click(deleteButtons[0]);

    // Verifica se o modal de confirmação apareceu
    expect(screen.getByText('Remover disponibilidade')).toBeInTheDocument();
    expect(screen.getByText(/Este horário faz parte de uma série recorrente/)).toBeInTheDocument();
    expect(screen.getByText('Excluir apenas este horário')).toBeInTheDocument();
    expect(screen.getByText('Excluir todas as recorrências')).toBeInTheDocument();
  });

  it('deve remover todas as recorrências ao confirmar "Excluir todas as recorrências"', async () => {
    const recurringProfile = {
      profile: {
        user: { name: 'João' },
        availability: JSON.stringify([
          { day: 'Segunda', start: '09:00', end: '10:00', id: 456, recurrence: 'DAILY' }
        ]),
      }
    };
    (getProfileMeSafe as jest.Mock).mockResolvedValue(recurringProfile);

    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getAllByText(/09:00 - 10:00/)).toHaveLength(7));

    fireEvent.click(screen.getAllByLabelText('Remover slot')[0]);
    fireEvent.click(screen.getByText('Excluir todas as recorrências'));

    await waitFor(() => {
      // saveDoctorAvailability deve ser chamado com um array vazio []
      expect(saveDoctorAvailability).toHaveBeenCalledWith("[]");
    });
  });

  it('deve remover apenas um dia ao clicar em "Excluir apenas este horário" em um slot DAILY', async () => {
    const recurringProfile = {
      profile: {
        user: { name: 'João' },
        availability: JSON.stringify([
          { day: 'Segunda', start: '09:00', end: '10:00', id: 456, recurrence: 'DAILY' }
        ]),
      }
    };
    (getProfileMeSafe as jest.Mock).mockResolvedValue(recurringProfile);

    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getAllByText(/09:00 - 10:00/)).toHaveLength(7));

    // Remove apenas a Segunda-feira
    fireEvent.click(screen.getAllByLabelText('Remover slot')[0]);
    fireEvent.click(screen.getByText('Excluir apenas este horário'));

    await waitFor(() => {
      // Deve ter chamado saveDoctorAvailability com slots quebrados de data, mas excluiu o principal.
      // O objetivo aqui é verificar se a persistência roda.
      expect(saveDoctorAvailability).toHaveBeenCalled();
    });
  });

  it('deve remover apenas um dia ao clicar em "Excluir apenas este horário" em um slot WEEKDAYS', async () => {
    const recurringProfile = {
      profile: {
        user: { name: 'João' },
        availability: JSON.stringify([
          { date: '2026-04-06', day: 'Segunda', start: '09:00', end: '10:00', id: 789, recurrence: 'WEEKDAYS' }
        ]),
      }
    };
    (getProfileMeSafe as jest.Mock).mockResolvedValue(recurringProfile);

    render(<DoctorAgenda />);
    await waitFor(() => expect(screen.getAllByText(/09:00 - 10:00/)).toHaveLength(5));

    // Remove apenas a Segunda-feira
    fireEvent.click(screen.getAllByLabelText('Remover slot')[0]);
    fireEvent.click(screen.getByText('Excluir apenas este horário'));

    await waitFor(() => {
      // Deve ter chamado saveDoctorAvailability para os remanescentes
      expect(saveDoctorAvailability).toHaveBeenCalled();
    });
  });
});
