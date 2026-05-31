# Frontend: A11y (Focus-Trap) e Decomposição da Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer a acessibilidade do `ModalBackdrop` com focus-trap completo e decompor a `agenda/page.tsx` (571 linhas) em hook testável + subcomponentes, eliminando a key de slot baseada no relógio do sistema.

**Architecture:** O `ModalBackdrop` ganha gestão de foco (foco inicial no container, ciclo de Tab/Shift+Tab entre focáveis, restauração ao desmontar) sem mudar a API pública. A lógica de slots/recorrência de `agenda/page.tsx` é extraída para o hook `useDoctorAvailability` (estado de `Slot[]` + add/edit/remove/remove-occurrence + persistência), espelhando o que `profile/page.tsx` fez com seus subcomponentes; a página passa a consumir o hook. IDs de slots novos passam a usar `crypto.randomUUID()` em vez de `Date.now()`, eliminando colisões e re-renders instáveis. O CI mantém lint bloqueante e o `next.config.js` documenta o plano de remoção de `eslint.ignoreDuringBuilds`.

**Tech Stack:** Next.js 15 (App Router) + React 19, TypeScript strict (ZERO `any`), Jest + `next/jest` (`jest-environment-jsdom`), `@testing-library/react` 16, `@testing-library/user-event` 14, `@testing-library/jest-dom`, date-fns.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/web/src/components/ui/ModalBackdrop.tsx` | Adicionar focus-trap (foco inicial, ciclo Tab/Shift+Tab, restauração) |
| Modify | `/root/rodrigo/hope_saude/apps/web/src/components/ui/__tests__/ModalBackdrop.test.tsx` | Testes de foco com `user-event` |
| Create | `/root/rodrigo/hope_saude/apps/web/src/hooks/useDoctorAvailability.ts` | Hook com estado de `Slot[]`, add/edit/remove/remove-occurrence, persistência |
| Create | `/root/rodrigo/hope_saude/apps/web/src/hooks/__tests__/useDoctorAvailability.test.ts` | Testes unitários do hook (add/remove/remove-occurrence) |
| Modify | `/root/rodrigo/hope_saude/apps/web/src/lib/slot-utils.ts` | Exportar `Slot.id` como `string`/`number` e helper `newSlotId()` (UUID estável) |
| Modify | `/root/rodrigo/hope_saude/apps/web/src/app/agenda/page.tsx` | Consumir `useDoctorAvailability`; trocar key de slot por id estável |
| Modify | `/root/rodrigo/hope_saude/apps/web/__tests__/DoctorAgenda.test.tsx` | Ajustar expectativas que dependiam de `id` numérico |
| Modify | `/root/rodrigo/hope_saude/apps/web/next.config.js` | Documentar/planejar remoção de `eslint.ignoreDuringBuilds` |

---

## Tasks

### Task 1 — Focus-trap no ModalBackdrop

Endurece a a11y de todos os 8+ modais que usam `ModalBackdrop` (via `Modal`): foco inicial no container ao montar, Tab/Shift+Tab presos aos focáveis internos, restauração do foco anterior ao desmontar. A API pública (`onClose`, `children`, `closeOnBackdropClick`, `label`, `className`) NÃO muda.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/components/ui/ModalBackdrop.tsx`
- Test: `/root/rodrigo/hope_saude/apps/web/src/components/ui/__tests__/ModalBackdrop.test.tsx`

- [ ] **Step 1: Escrever os testes que falham.** Acrescente os testes abaixo ao final do `describe` existente em `ModalBackdrop.test.tsx` (NÃO remova os 6 testes atuais). Eles cobrem foco inicial, ciclo de Tab, ciclo de Shift+Tab e restauração de foco.

```tsx
  it('foca o container do dialog ao montar', () => {
    render(
      <ModalBackdrop onClose={() => {}} label="Foco inicial">
        <div>
          <button type="button">Primeiro</button>
        </div>
      </ModalBackdrop>,
    );
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('prende o Tab no último focável de volta para o primeiro', async () => {
    const user = userEvent.setup();
    render(
      <ModalBackdrop onClose={() => {}} label="Trap Tab">
        <div>
          <button type="button">Primeiro</button>
          <button type="button">Ultimo</button>
        </div>
      </ModalBackdrop>,
    );

    const primeiro = screen.getByRole('button', { name: 'Primeiro' });
    const ultimo = screen.getByRole('button', { name: 'Ultimo' });

    ultimo.focus();
    expect(ultimo).toHaveFocus();

    await user.tab();
    expect(primeiro).toHaveFocus();
  });

  it('prende o Shift+Tab no primeiro focável de volta para o último', async () => {
    const user = userEvent.setup();
    render(
      <ModalBackdrop onClose={() => {}} label="Trap Shift+Tab">
        <div>
          <button type="button">Primeiro</button>
          <button type="button">Ultimo</button>
        </div>
      </ModalBackdrop>,
    );

    const primeiro = screen.getByRole('button', { name: 'Primeiro' });
    const ultimo = screen.getByRole('button', { name: 'Ultimo' });

    primeiro.focus();
    expect(primeiro).toHaveFocus();

    await user.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it('restaura o foco ao elemento anterior quando desmonta', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Abrir';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { unmount } = render(
      <ModalBackdrop onClose={() => {}} label="Restaura foco">
        <div>
          <button type="button">Dentro</button>
        </div>
      </ModalBackdrop>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    document.body.removeChild(trigger);
  });
```

- [ ] **Step 2: Rodar os testes para confirmar que falham.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/ui/__tests__/ModalBackdrop.test.tsx --no-coverage
```

Saída esperada: os 6 testes antigos passam; os 4 novos falham. Mensagens do tipo `expect(element).toHaveFocus()` com "Expected element with focus: <div role=dialog>... Received element with focus: <body>" (foco inicial), e nos testes de Tab o foco permanece no botão original em vez de ciclar.

- [ ] **Step 3: Escrever a implementação mínima.** Substitua o conteúdo completo de `ModalBackdrop.tsx` por:

```tsx
'use client';

import { useEffect, useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
  /** Se true, clicar no backdrop fecha o modal (default). */
  closeOnBackdropClick?: boolean;
  /** Aria-label do dialog; se ausente usa aria-modal sozinho. */
  label?: string;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Backdrop genérico para modais.
 *
 * a11y:
 * - `role="dialog"` + `aria-modal="true"`
 * - Escape fecha (listener no window)
 * - Focus-trap: foca o container ao montar, prende Tab/Shift+Tab nos
 *   focáveis internos e restaura o foco anterior ao desmontar.
 * - `onKeyDown={onClose}` no próprio backdrop para satisfazer
 *   `click-events-have-key-events` do eslint-plugin-jsx-a11y
 * - `stopPropagation` no container interno (para clicar dentro do modal
 *   sem fechar)
 *
 * Substitui o padrão `<div onClick={onClose}>...</div>` que existia
 * repetido em 8+ modais com eslint-disable.
 */
export function ModalBackdrop({
  onClose,
  children,
  closeOnBackdropClick = true,
  label,
  className = '',
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleTrapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const container = dialogRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || active === container) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    // Só fecha se o click foi no backdrop, não no conteúdo
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleTrapKeyDown(e);
    if (e.defaultPrevented) return;
    if (!closeOnBackdropClick) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/ui/__tests__/ModalBackdrop.test.tsx --no-coverage
```

Saída esperada: `Tests: 10 passed, 10 total`. Em seguida rode a suíte de Modal para garantir não-regressão dos modais que dependem do backdrop:

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/ui --no-coverage
```

Saída esperada: todas as suítes verdes.

- [ ] **Step 5: Validar no browser (Playwright MCP).** Inicie o dev server (`cd /root/rodrigo/hope_saude/apps/web && npm run dev`), navegue até uma tela com modal (ex.: `/agenda` → botão "Nova disponibilidade"), abra o modal e confirme: (a) ao abrir, o foco entra no dialog; (b) Tab cicla apenas entre os campos do modal sem escapar para a página de fundo; (c) ESC fecha; (d) ao fechar, o foco volta ao botão que abriu. Tire um screenshot da tab presa dentro do modal.

- [ ] **Step 6: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/components/ui/ModalBackdrop.tsx apps/web/src/components/ui/__tests__/ModalBackdrop.test.tsx && git commit -m "feat(web): focus-trap no ModalBackdrop para a11y de modais"
```

---

### Task 2 — Helper `newSlotId()` e tipo `Slot.id` em `slot-utils`

A key de slot gerada por `Date.now()` (agenda/page.tsx:211 e :254/:266 em `removeOnlyThisOccurrence`) colide quando dois slots são criados no mesmo milissegundo e produz keys instáveis no React. Introduz `newSlotId()` retornando UUID estável e amplia `Slot.id` para aceitar `string`. Esta Task é pré-requisito da Task 3.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/lib/slot-utils.ts`
- Test: `/root/rodrigo/hope_saude/apps/web/src/lib/__tests__/slot-utils.test.ts` (criar se não existir)

- [ ] **Step 1: Escrever o teste que falha.** Crie/edite `/root/rodrigo/hope_saude/apps/web/src/lib/__tests__/slot-utils.test.ts` com:

```ts
import { newSlotId, mergeSlots, type Slot } from '../slot-utils';

describe('newSlotId', () => {
  it('gera ids únicos em chamadas consecutivas (sem colisão de relógio)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(newSlotId());
    }
    expect(ids.size).toBe(1000);
  });

  it('retorna string não vazia', () => {
    expect(typeof newSlotId()).toBe('string');
    expect(newSlotId().length).toBeGreaterThan(0);
  });
});

describe('mergeSlots aceita ids string', () => {
  it('preserva slots com id string sem quebrar', () => {
    const slots: Slot[] = [
      { id: 'a-1', day: 'Segunda', start: '08:00', end: '09:00' },
      { id: 'a-2', day: 'Segunda', start: '09:00', end: '10:00' },
    ];
    const merged = mergeSlots(slots);
    expect(merged).toHaveLength(1);
    expect(merged[0].start).toBe('08:00');
    expect(merged[0].end).toBe('10:00');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/lib/__tests__/slot-utils.test.ts --no-coverage
```

Saída esperada: falha de compilação/import `newSlotId is not a function` (ou `has no exported member 'newSlotId'`), e o teste de `Slot` com id string falha no type-check porque `Slot.id` é `number`.

- [ ] **Step 3: Escrever a implementação mínima.** Em `slot-utils.ts`, altere o tipo `Slot.id` e acrescente o helper. Edite o topo do arquivo:

```ts
export type Slot = {
  id: number | string;
  date?: string; // YYYY-MM-DD
  day?: string; // Segunda, etc.
  start: string;
  end: string;
  recurrence?: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
};

/**
 * ID estável para slots novos. Usa crypto.randomUUID quando disponível
 * (evita colisão de Date.now() em criações no mesmo milissegundo); cai
 * num contador monotônico como fallback (jsdom/ambientes sem crypto.uuid).
 */
let slotCounter = 0;
export function newSlotId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  slotCounter += 1;
  return `slot-${Date.now()}-${slotCounter}`;
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/lib/__tests__/slot-utils.test.ts --no-coverage && npx tsc --noEmit -p /root/rodrigo/hope_saude/apps/web/tsconfig.json
```

Saída esperada: `Tests: ... passed`; `tsc --noEmit` sem erros.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/lib/slot-utils.ts apps/web/src/lib/__tests__/slot-utils.test.ts && git commit -m "feat(web): newSlotId() com UUID estável e Slot.id string em slot-utils"
```

---

### Task 3 — Hook `useDoctorAvailability` (extração da lógica de slots)

Extrai TODA a lógica de estado/recorrência/persistência da `agenda/page.tsx` para um hook testável, espelhando a decomposição já feita em `profile/page.tsx`. O hook recebe `weekStart` (para expandir DAILY/WEEKDAYS) e expõe `availability`, `addOrUpdateSlot`, `removeSlot`, `removeOnlyThisOccurrence`, `setAvailability`, `loadError`. Usa `newSlotId()` (Task 2) em vez de `Date.now()`.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/web/src/hooks/useDoctorAvailability.ts`
- Test: `/root/rodrigo/hope_saude/apps/web/src/hooks/__tests__/useDoctorAvailability.test.ts`

- [ ] **Step 1: Escrever o teste que falha.** Crie `/root/rodrigo/hope_saude/apps/web/src/hooks/__tests__/useDoctorAvailability.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDoctorAvailability } from '../useDoctorAvailability';
import { saveDoctorAvailability } from '@/lib/doctor-dashboard-api';
import type { Slot } from '@/lib/slot-utils';

jest.mock('@/lib/doctor-dashboard-api', () => ({
  saveDoctorAvailability: jest.fn().mockResolvedValue(undefined),
}));

const WEEK_START = new Date('2026-04-05T00:00:00'); // domingo

describe('useDoctorAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adiciona um slot novo com id estável e persiste', async () => {
    const { result } = renderHook(() => useDoctorAvailability(WEEK_START));

    await act(async () => {
      await result.current.addOrUpdateSlot(null, {
        date: '2026-04-06',
        start: '09:00',
        end: '10:00',
        recurrence: 'NONE',
        isRecurrenceChecked: false,
      });
    });

    expect(result.current.availability).toHaveLength(1);
    const created = result.current.availability[0];
    expect(typeof created.id).toBe('string');
    expect(created.start).toBe('09:00');
    expect(created.end).toBe('10:00');
    expect(created.recurrence).toBe('NONE');
    expect(saveDoctorAvailability).toHaveBeenCalledWith(
      expect.stringContaining('"start":"09:00"'),
    );
  });

  it('edita um slot existente preservando o id', async () => {
    const initial: Slot[] = [
      { id: 'fixed-1', date: '2026-04-06', day: 'Segunda', start: '09:00', end: '10:00', recurrence: 'NONE' },
    ];
    const { result } = renderHook(() => useDoctorAvailability(WEEK_START, initial));

    await act(async () => {
      await result.current.addOrUpdateSlot('fixed-1', {
        date: '2026-04-06',
        start: '09:00',
        end: '11:00',
        recurrence: 'NONE',
        isRecurrenceChecked: false,
      });
    });

    expect(result.current.availability).toHaveLength(1);
    expect(result.current.availability[0].id).toBe('fixed-1');
    expect(result.current.availability[0].end).toBe('11:00');
  });

  it('remove um slot por id', async () => {
    const initial: Slot[] = [
      { id: 'fixed-1', day: 'Segunda', start: '09:00', end: '10:00', recurrence: 'NONE' },
    ];
    const { result } = renderHook(() => useDoctorAvailability(WEEK_START, initial));

    await act(async () => {
      await result.current.removeSlot('fixed-1');
    });

    expect(result.current.availability).toHaveLength(0);
    expect(saveDoctorAvailability).toHaveBeenCalledWith('[]');
  });

  it('remove apenas a ocorrência de um slot DAILY, gerando os 6 dias restantes com ids estáveis', async () => {
    const initial: Slot[] = [
      { id: 'daily-1', date: '2026-04-06', day: 'Segunda', start: '09:00', end: '10:00', recurrence: 'DAILY' },
    ];
    const { result } = renderHook(() => useDoctorAvailability(WEEK_START, initial));

    await act(async () => {
      await result.current.removeOnlyThisOccurrence('daily-1', '2026-04-06');
    });

    // O slot DAILY original sai; sobram 6 dias da semana como NONE
    expect(result.current.availability).toHaveLength(6);
    const ids = result.current.availability.map((s) => s.id);
    expect(new Set(ids).size).toBe(6); // ids únicos (sem colisão de Date.now)
    expect(result.current.availability.every((s) => s.recurrence === 'NONE')).toBe(true);
    expect(result.current.availability.some((s) => s.date === '2026-04-06')).toBe(false);
  });

  it('seta loadError quando a persistência falha', async () => {
    (saveDoctorAvailability as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useDoctorAvailability(WEEK_START));

    await act(async () => {
      await result.current.addOrUpdateSlot(null, {
        date: '2026-04-06',
        start: '09:00',
        end: '10:00',
        recurrence: 'NONE',
        isRecurrenceChecked: false,
      });
    });

    await waitFor(() =>
      expect(result.current.loadError).toBe('Não foi possível salvar a disponibilidade.'),
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/hooks/__tests__/useDoctorAvailability.test.ts --no-coverage
```

Saída esperada: falha de import `Cannot find module '../useDoctorAvailability'` / `useDoctorAvailability is not a function`.

- [ ] **Step 3: Escrever a implementação mínima.** Crie `/root/rodrigo/hope_saude/apps/web/src/hooks/useDoctorAvailability.ts`:

```ts
import { useState, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { saveDoctorAvailability } from '@/lib/doctor-dashboard-api';
import { mergeSlots, newSlotId, type Slot } from '@/lib/slot-utils';

export type AvailabilityFormData = {
  date: string;
  start: string;
  end: string;
  recurrence: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
  isRecurrenceChecked: boolean;
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Estado e regras de disponibilidade do médico, extraídos de agenda/page.tsx.
 * `weekStart` é o domingo da semana visível, usado para expandir DAILY/WEEKDAYS
 * ao remover uma ocorrência específica.
 */
export function useDoctorAvailability(weekStart: Date, initial: Slot[] = []) {
  const [availability, setAvailability] = useState<Slot[]>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);

  const persist = useCallback(async (data: Slot[]) => {
    try {
      await saveDoctorAvailability(JSON.stringify(data));
    } catch {
      setLoadError('Não foi possível salvar a disponibilidade.');
    }
  }, []);

  const addOrUpdateSlot = useCallback(
    async (editingSlotId: Slot['id'] | null, data: AvailabilityFormData) => {
      const finalRecurrence = data.isRecurrenceChecked ? data.recurrence : 'NONE';
      const dateObj = new Date(`${data.date}T12:00:00Z`);
      const dayOfWeekStr = DAY_NAMES[dateObj.getUTCDay()];

      let updated: Slot[];
      if (editingSlotId !== null) {
        updated = availability.map((s) =>
          s.id === editingSlotId
            ? {
                ...s,
                date: data.date,
                day: dayOfWeekStr,
                start: data.start,
                end: data.end,
                recurrence: finalRecurrence,
              }
            : s,
        );
      } else {
        updated = [
          ...availability,
          {
            id: newSlotId(),
            date: data.date,
            day: dayOfWeekStr,
            start: data.start,
            end: data.end,
            recurrence: finalRecurrence,
          },
        ];
      }

      const merged = mergeSlots(updated);
      setAvailability(merged);
      await persist(merged);
    },
    [availability, persist],
  );

  const removeSlot = useCallback(
    async (id: Slot['id']) => {
      const updated = availability.filter((s) => s.id !== id);
      setAvailability(updated);
      await persist(updated);
    },
    [availability, persist],
  );

  const removeOnlyThisOccurrence = useCallback(
    async (id: Slot['id'], targetDateStr: string) => {
      const slot = availability.find((s) => s.id === id);
      if (!slot) return;

      const rest = availability.filter((s) => s.id !== id);
      let newSlots: Slot[] = [];

      if (slot.recurrence === 'DAILY') {
        const dates = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
        newSlots = dates
          .map((d) => format(d, 'yyyy-MM-dd'))
          .filter((dStr) => dStr !== targetDateStr)
          .map((dStr) => ({ ...slot, id: newSlotId(), date: dStr, recurrence: 'NONE' as const }));
      } else if (slot.recurrence === 'WEEKDAYS') {
        const dates = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i + 1));
        newSlots = dates
          .map((d) => format(d, 'yyyy-MM-dd'))
          .filter((dStr) => dStr !== targetDateStr)
          .map((dStr) => ({ ...slot, id: newSlotId(), date: dStr, recurrence: 'NONE' as const }));
      }

      const updated = [...rest, ...newSlots];
      setAvailability(updated);
      await persist(updated);
    },
    [availability, weekStart, persist],
  );

  return {
    availability,
    setAvailability,
    loadError,
    setLoadError,
    addOrUpdateSlot,
    removeSlot,
    removeOnlyThisOccurrence,
  };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/hooks/__tests__/useDoctorAvailability.test.ts --no-coverage && npx tsc --noEmit -p /root/rodrigo/hope_saude/apps/web/tsconfig.json
```

Saída esperada: `Tests: 5 passed, 5 total`; `tsc --noEmit` sem erros.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/hooks/useDoctorAvailability.ts apps/web/src/hooks/__tests__/useDoctorAvailability.test.ts && git commit -m "feat(web): hook useDoctorAvailability extraindo lógica de slots da agenda"
```

---

### Task 4 — Integrar o hook na `agenda/page.tsx` e estabilizar a key de slot

A página passa a consumir `useDoctorAvailability` (Task 3): remove os métodos `addSlot`/`removeSlot`/`removeOnlyThisOccurrence`/`persistAvailability` inline e o estado `availability`, e troca a key de render `key={`${slot.id}-${dateStr}`}` mantendo `slot.id` agora estável (string). O `editingSlotId` passa a ser `Slot['id'] | null`. A suíte `DoctorAgenda.test.tsx` é ajustada onde dependia de `id` numérico.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/app/agenda/page.tsx`
- Test: `/root/rodrigo/hope_saude/apps/web/__tests__/DoctorAgenda.test.tsx`

- [ ] **Step 1: Ajustar o teste para o novo contrato (red).** No `DoctorAgenda.test.tsx`, o teste "deve atualizar o slot ao clicar em Atualizar" verifica `expect.stringContaining('"id":123')`. Como o `id` original `123` vem do mock e é PRESERVADO na edição (o hook só troca id em criação/expansão), esse teste continua válido — NÃO altere essa asserção. Acrescente um novo teste que comprova que slots recém-criados recebem id string (não-numérico do relógio). Adicione ao final do `describe`:

```tsx
  it('cria slot novo com id string estável (não Date.now numérico)', async () => {
    (getProfileMeSafe as jest.Mock).mockResolvedValue({
      profile: { user: { name: 'João' }, availability: JSON.stringify([]) },
    });

    render(<DoctorAgenda />);
    await waitFor(() =>
      expect(screen.getByText('Agenda de Disponibilidade')).toBeInTheDocument(),
    );

    // Abre o modal de novo slot pela toolbar
    fireEvent.click(screen.getByText('Novo horário'));

    // Confirma com os defaults (08:00 - 09:00)
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(saveDoctorAvailability).toHaveBeenCalled();
    });
    const payload = (saveDoctorAvailability as jest.Mock).mock.calls.at(-1)![0] as string;
    const parsed = JSON.parse(payload) as Array<{ id: unknown }>;
    expect(parsed).toHaveLength(1);
    expect(typeof parsed[0].id).toBe('string');
  });
```

Antes de rodar, confirme os rótulos reais dos botões da `CalendarToolbar` e do botão de salvar do `AvailabilityModal`:

```bash
cd /root/rodrigo/hope_saude/apps/web && grep -rn "Novo horário\|Salvar\|onNewSlot" src/components/agenda/CalendarToolbar.tsx src/components/AvailabilityModal.tsx
```

Se os textos diferirem (ex.: "Novo" / "Confirmar"), ajuste as duas strings `getByText` do teste acima para os literais reais ANTES do Step 2.

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest __tests__/DoctorAgenda.test.tsx --no-coverage
```

Saída esperada: o novo teste falha em `expect(typeof parsed[0].id).toBe('string')` recebendo `'number'` (a página ainda usa `Date.now()`). Os demais testes seguem verdes.

- [ ] **Step 3: Escrever a implementação mínima.** Em `agenda/page.tsx`:

  1. Trocar imports: remova `saveDoctorAvailability` do import de `@/lib/doctor-dashboard-api` (o hook passa a persistir) e remova `mergeSlots` se deixar de ser usado diretamente fora do `load`; adicione o import do hook.

```tsx
import {
  getProfileMeSafe,
  fetchAppointmentsMe,
} from '@/lib/doctor-dashboard-api';
import { useGridSelection } from '@/hooks/useGridSelection';
import { useDoctorAvailability } from '@/hooks/useDoctorAvailability';
import { doesSlotApplyToDate, mergeSlots, type Slot, TIME_SLOTS } from '@/lib/slot-utils';
```

  2. Substituir o estado `const [availability, setAvailability] = useState<Slot[]>([]);` e `editingSlotId` por:

```tsx
  const [editingSlotId, setEditingSlotId] = useState<Slot['id'] | null>(null);
```

  3. Logo após o cálculo de `weekStart` (que precisa subir antes do uso do hook), instanciar o hook. Mova a linha `const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });` para antes da chamada do hook e adicione:

```tsx
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
  const currentWeekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const {
    availability,
    setAvailability,
    loadError: saveError,
    addOrUpdateSlot,
    removeSlot,
    removeOnlyThisOccurrence,
  } = useDoctorAvailability(weekStart);
```

  4. Remover os métodos inline `addSlot`, `removeSlot`, `removeOnlyThisOccurrence` e `persistAvailability` do componente (agora vêm do hook). No `load`, manter `setAvailability(mergeSlots(JSON.parse(...)))`.

  5. No callback do `AvailabilityModal`, trocar `onConfirm={addSlot}` por:

```tsx
        onConfirm={(data) => {
          void addOrUpdateSlot(editingSlotId, data).then(() => {
            setIsModalOpen(false);
            setEditingSlotId(null);
          });
        }}
```

  6. No `DeleteConfirmModal`, os handlers passam a chamar o hook diretamente:

```tsx
        onRemoveOnlyThis={() => {
          if (slotToDelete) {
            void removeOnlyThisOccurrence(slotToDelete.id, slotToDelete.targetDate).then(() => {
              setIsDeleteConfirmOpen(false);
              setSlotToDelete(null);
            });
          }
        }}
        onRemoveAll={() => {
          if (slotToDelete) {
            void removeSlot(slotToDelete.id).then(() => {
              setIsDeleteConfirmOpen(false);
              setSlotToDelete(null);
            });
          }
        }}
```

  7. No botão de remover inline do slot (atual `void removeSlot(slot.id)`), manter a chamada — agora resolve para o método do hook.

  8. Ajustar `slotToDelete` para `useState<{ id: Slot['id']; targetDate: string } | null>(null)`.

  9. A key de render `key={`${slot.id}-${dateStr}`}` permanece, mas agora `slot.id` é estável (string para criados, número legado preservado para slots vindos do banco).

  10. Exibir `saveError` junto do `loadError` existente (ou reaproveitar o bloco de aviso): no JSX do aviso, trocar a condição para `{loadError || saveError ? (` e renderizar `{loadError || saveError}`.

- [ ] **Step 4: Rodar os testes para confirmar que passam.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest __tests__/DoctorAgenda.test.tsx src/hooks/__tests__/useDoctorAvailability.test.ts --no-coverage && npx tsc --noEmit -p /root/rodrigo/hope_saude/apps/web/tsconfig.json
```

Saída esperada: todos os testes da agenda verdes (incluindo o novo de id string) e `tsc --noEmit` sem erros. Rode também a suíte web completa para garantir não-regressão:

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest --no-coverage
```

Saída esperada: `Tests: 184 passed` (183 anteriores + 1 novo da agenda; somados aos novos de Task 1/2/3 a contagem total sobe — confirme apenas que NÃO há falhas).

- [ ] **Step 5: Validar no browser (Playwright MCP).** Com o dev server rodando, em `/agenda`: crie um slot novo, edite-o, e remova uma ocorrência de um slot recorrente DAILY. Confirme que a grade re-renderiza sem "piscar" e que criar dois slots rápidos não colide. Screenshot da agenda com os slots.

- [ ] **Step 6: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/app/agenda/page.tsx apps/web/__tests__/DoctorAgenda.test.tsx && git commit -m "refactor(web): agenda consome useDoctorAvailability e usa id de slot estável"
```

---

### Task 5 — Planejar remoção de `eslint.ignoreDuringBuilds` no `next.config.js`

A sprint de a11y (Tasks 1-4) elimina parte dos warnings que motivaram `ignoreDuringBuilds: true`. Documenta no `next.config.js` o critério objetivo de remoção (CI lint zero-warning) sem ainda derrubar o build — a remoção efetiva acontece quando o lint do CI estiver verde sem ignores. Verifica que o CI já roda lint bloqueante.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/next.config.js`
- Test: validação manual via comando de lint (não há teste unitário para config)

- [ ] **Step 1: Verificar o estado do lint e do CI (linha de base).**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx next lint 2>&1 | tail -30; echo "=== CI ==="; grep -rn "lint\|next lint\|eslint" /root/rodrigo/hope_saude/.github/workflows/ 2>/dev/null
```

Saída esperada: a lista atual de warnings de a11y e a confirmação de que `.github/workflows/ci.yml` invoca lint. Anote o número de warnings restantes — esse é o alvo a zerar antes de remover o ignore.

- [ ] **Step 2: Atualizar o comentário do `next.config.js` com o critério de saída.** Substitua o bloco de comentário/`eslint` por:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint é validado de forma BLOQUEANTE em CI (.github/workflows/ci.yml).
  //
  // `ignoreDuringBuilds` é stopgap temporário: impede que warnings de a11y
  // herdados de código legado quebrem o build de produção enquanto a sprint
  // de a11y está em andamento (focus-trap no ModalBackdrop, decomposição da
  // agenda — ver docs/superpowers/plans/2026-05-31-longo-02-frontend-a11y-decomposicao.md).
  //
  // CRITÉRIO DE REMOÇÃO: assim que `npx next lint` rodar com ZERO warnings
  // (rodar `cd apps/web && npx next lint`), apagar o bloco `eslint` abaixo
  // para que o build de produção volte a falhar em regressões de a11y.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
```

- [ ] **Step 3: Confirmar que o build ainda passa e o lint segue rodando no CI.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx next lint 2>&1 | tail -5
```

Saída esperada: o lint roda (warnings continuam reportados, mas não bloqueiam o build local enquanto o ignore existir). O comentário agora documenta o gatilho objetivo de remoção.

- [ ] **Step 4: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/next.config.js && git commit -m "docs(web): critério objetivo para remover eslint.ignoreDuringBuilds pós-sprint a11y"
```

---

## Self-Review

Cobertura dos gaps do escopo:

- **Gap 1 — Focus-trap no ModalBackdrop:** Task 1. Foco inicial via `dialogRef.current?.focus()` em `useEffect` de montagem; ciclo Tab/Shift+Tab em `handleTrapKeyDown` (preso ao `FOCUSABLE_SELECTOR`); restauração via `previouslyFocused?.focus()` no cleanup. Testes com `userEvent.setup()` + `user.tab()` / `user.tab({ shift: true })` cobrindo foco inicial, ciclo nos dois sentidos, ESC (já existente) e restauração. Validação no browser no Step 5.
- **Gap 2 — Decomposição da agenda:** Tasks 2-4. Lógica de slots extraída para `useDoctorAvailability` (testável isoladamente: add/edit/remove/remove-occurrence DAILY + erro de persistência). Key de slot deixa de usar `Date.now()` (agenda/page.tsx:211 e :254/:266) e passa a `newSlotId()` (UUID estável com fallback monotônico). Espelha o padrão de `profile/page.tsx`, que já consome hooks de query + subcomponentes em `components/profile/`.
- **Gap 3 — next.config.js:** Task 5. Mantém lint BLOQUEANTE no CI, documenta critério objetivo de remoção do `ignoreDuringBuilds` (zero warnings em `next lint`), sem derrubar o build prematuramente.

TDD: toda Task escreve o teste vermelho antes da implementação (Steps 1-2 red, Steps 3-4 green). Comandos exatos com `cd /root/rodrigo/hope_saude/apps/web && npx jest <arquivo> --no-coverage` e `tsc --noEmit`. Path correto `/root/rodrigo/hope_saude` em todos os comandos.

Sem placeholders: todos os blocos de código são completos e fiéis ao repo (imports reais — `saveDoctorAvailability`, `mergeSlots`, `Slot`, `useGridSelection`, `getProfileMeSafe`; shape real de `AvailabilityFormData` igual ao `onConfirm` do `AvailabilityModal`; `Slot.id` ampliado para `number | string`; `DAY_NAMES`/`getUTCDay` consistente com `addSlot` original). Tipos referenciados (`AvailabilityFormData`, `newSlotId`, `Slot['id']`) são definidos nas Tasks 2-3 antes do uso na Task 4. ZERO `any` em produção; testes usam `unknown` + cast onde inspecionam JSON. Sem `forwardRef`. Step 1 da Task 4 inclui verificação dos literais reais dos botões antes de rodar, evitando suposição de texto.
