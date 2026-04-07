import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ModalBackdrop } from '../ModalBackdrop';

describe('ModalBackdrop', () => {
  it('renderiza children com role=dialog e aria-modal', () => {
    render(
      <ModalBackdrop onClose={() => {}} label="Test modal">
        <div>Conteúdo do modal</div>
      </ModalBackdrop>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test modal');
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();
  });

  it('fecha ao clicar no backdrop (fora do conteúdo)', async () => {
    const onClose = jest.fn();
    render(
      <ModalBackdrop onClose={onClose}>
        <div data-testid="content">X</div>
      </ModalBackdrop>,
    );

    // Click direto no backdrop (o dialog)
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('NÃO fecha ao clicar no conteúdo interno', async () => {
    const onClose = jest.fn();
    render(
      <ModalBackdrop onClose={onClose}>
        <div data-testid="content">X</div>
      </ModalBackdrop>,
    );

    await userEvent.click(screen.getByTestId('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fecha ao pressionar Escape', async () => {
    const onClose = jest.fn();
    render(
      <ModalBackdrop onClose={onClose}>
        <div>X</div>
      </ModalBackdrop>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respeita closeOnBackdropClick=false', async () => {
    const onClose = jest.fn();
    render(
      <ModalBackdrop onClose={onClose} closeOnBackdropClick={false}>
        <div>X</div>
      </ModalBackdrop>,
    );

    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape ainda fecha mesmo com closeOnBackdropClick=false (ESC é safety)', async () => {
    const onClose = jest.fn();
    render(
      <ModalBackdrop onClose={onClose} closeOnBackdropClick={false}>
        <div>X</div>
      </ModalBackdrop>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
