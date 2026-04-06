import { renderHook, act } from '@testing-library/react';
import { useGridSelection } from '../useGridSelection';

describe('useGridSelection', () => {
  it('deve iniciar sem seleção', () => {
    const { result } = renderHook(() => useGridSelection());
    expect(result.current.selection).toBeNull();
  });

  it('deve iniciar seleção no mouseDown', () => {
    const { result } = renderHook(() => useGridSelection());
    
    act(() => {
      result.current.handleMouseDown('Segunda', '08:00');
    });

    expect(result.current.selection).toEqual({
      day: 'Segunda',
      start: '08:00',
      end: '08:00',
    });
  });

  it('deve atualizar o fim da seleção no mouseEnter se for no mesmo dia', () => {
    const { result } = renderHook(() => useGridSelection());
    
    act(() => {
      result.current.handleMouseDown('Segunda', '08:00');
    });

    act(() => {
      result.current.handleMouseEnter('Segunda', '10:00');
    });

    expect(result.current.selection?.end).toBe('10:00');
  });

  it('não deve atualizar seleção se mudar de dia durante o arrasto', () => {
    const { result } = renderHook(() => useGridSelection());
    
    act(() => {
      result.current.handleMouseDown('Segunda', '08:00');
    });

    act(() => {
      result.current.handleMouseEnter('Terça', '10:00');
    });

    expect(result.current.selection?.day).toBe('Segunda');
    expect(result.current.selection?.end).toBe('08:00');
  });

  it('deve resetar seleção no mouseUp', () => {
    const onSelect = jest.fn();
    const { result } = renderHook(() => useGridSelection(onSelect));
    
    act(() => {
      result.current.handleMouseDown('Segunda', '08:00');
    });

    act(() => {
      result.current.handleMouseEnter('Segunda', '10:00');
    });

    act(() => {
      result.current.handleMouseUp();
    });

    expect(onSelect).toHaveBeenCalledWith('Segunda', '08:00', '10:00');
    expect(result.current.selection).toBeNull();
  });
});
