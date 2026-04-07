/**
 * Definições puras das escalas psicométricas suportadas.
 * Cada escala é um array de perguntas + função de scoring + classificação
 * de severidade. Lógica pura, 100% testável sem mocks.
 */

export type ScaleType = 'PHQ9' | 'GAD7' | 'AUDIT' | 'MOCA';

export interface ScaleQuestion {
  id: number;
  text: string;
  options: Array<{ value: number; label: string }>;
}

export interface ScaleDefinition {
  type: ScaleType;
  title: string;
  description: string;
  questions: ScaleQuestion[];
  maxScore: number;
  /** Recebe array de answers (valor numérico por pergunta, na ordem). */
  calculateScore: (answers: number[]) => number;
  /** Recebe o score total e devolve a severidade clínica. */
  classifySeverity: (score: number) => string;
}

// ---------------------------------------------------------------------------
// PHQ-9 (Patient Health Questionnaire) — depressão
// ---------------------------------------------------------------------------
const PHQ9_OPTIONS = [
  { value: 0, label: 'Nenhuma vez' },
  { value: 1, label: 'Vários dias' },
  { value: 2, label: 'Mais da metade dos dias' },
  { value: 3, label: 'Quase todos os dias' },
];

const PHQ9_PROMPTS = [
  'Pouco interesse ou prazer em fazer as coisas',
  'Sentir-se para baixo, deprimido(a) ou sem perspectiva',
  'Dificuldade para pegar no sono, continuar dormindo ou dormir demais',
  'Sentir-se cansado(a) ou com pouca energia',
  'Falta de apetite ou comendo demais',
  'Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso',
  'Dificuldade para se concentrar em coisas como ler jornal ou ver TV',
  'Lentidão para falar/mover-se, ou agitação/inquietação acima do normal',
  'Pensamentos de que seria melhor estar morto(a) ou de se ferir',
];

export const PHQ9: ScaleDefinition = {
  type: 'PHQ9',
  title: 'PHQ-9 — Avaliação de Depressão',
  description:
    'Nas últimas 2 semanas, com que frequência você foi incomodado(a) por qualquer um dos problemas abaixo?',
  maxScore: 27,
  questions: PHQ9_PROMPTS.map((text, i) => ({
    id: i + 1,
    text,
    options: PHQ9_OPTIONS,
  })),
  calculateScore: (answers) => answers.reduce((sum, a) => sum + (a ?? 0), 0),
  classifySeverity: (score) => {
    if (score <= 4) return 'mínima';
    if (score <= 9) return 'leve';
    if (score <= 14) return 'moderada';
    if (score <= 19) return 'moderadamente grave';
    return 'grave';
  },
};

// ---------------------------------------------------------------------------
// GAD-7 (Generalized Anxiety Disorder) — ansiedade
// ---------------------------------------------------------------------------
const GAD7_PROMPTS = [
  'Sentir-se nervoso(a), ansioso(a) ou no limite',
  'Não conseguir parar ou controlar as preocupações',
  'Preocupar-se muito com coisas diferentes',
  'Dificuldade para relaxar',
  'Sentir-se tão inquieto(a) que fica difícil ficar parado(a)',
  'Ficar facilmente aborrecido(a) ou irritado(a)',
  'Sentir medo de que algo terrível possa acontecer',
];

export const GAD7: ScaleDefinition = {
  type: 'GAD7',
  title: 'GAD-7 — Avaliação de Ansiedade',
  description:
    'Nas últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas abaixo?',
  maxScore: 21,
  questions: GAD7_PROMPTS.map((text, i) => ({
    id: i + 1,
    text,
    options: PHQ9_OPTIONS, // mesmas opções
  })),
  calculateScore: (answers) => answers.reduce((sum, a) => sum + (a ?? 0), 0),
  classifySeverity: (score) => {
    if (score <= 4) return 'mínima';
    if (score <= 9) return 'leve';
    if (score <= 14) return 'moderada';
    return 'grave';
  },
};

// ---------------------------------------------------------------------------
// AUDIT (Alcohol Use Disorders Identification Test)
// ---------------------------------------------------------------------------
const AUDIT_PROMPTS: Array<{ text: string; options: Array<{ value: number; label: string }> }> = [
  {
    text: 'Com que frequência você toma bebidas alcoólicas?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Mensalmente ou menos' },
      { value: 2, label: '2 a 4 vezes por mês' },
      { value: 3, label: '2 a 3 vezes por semana' },
      { value: 4, label: '4 ou mais vezes por semana' },
    ],
  },
  {
    text: 'Nas ocasiões em que bebe, quantas doses costuma tomar?',
    options: [
      { value: 0, label: '1 ou 2' },
      { value: 1, label: '3 ou 4' },
      { value: 2, label: '5 ou 6' },
      { value: 3, label: '7 a 9' },
      { value: 4, label: '10 ou mais' },
    ],
  },
  {
    text: 'Com que frequência você toma 6 ou mais doses em uma ocasião?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Com que frequência, no último ano, você não conseguiu parar de beber uma vez que começou?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Com que frequência, no último ano, deixou de fazer o que era esperado por causa do álcool?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Com que frequência, no último ano, precisou de uma dose logo pela manhã após beber muito?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Com que frequência, no último ano, você sentiu culpa ou remorso após beber?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Com que frequência, no último ano, foi incapaz de lembrar o que aconteceu na noite anterior porque havia bebido?',
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Menos que mensalmente' },
      { value: 2, label: 'Mensalmente' },
      { value: 3, label: 'Semanalmente' },
      { value: 4, label: 'Diariamente ou quase' },
    ],
  },
  {
    text: 'Você ou outra pessoa já se machucou por causa da sua bebida?',
    options: [
      { value: 0, label: 'Não' },
      { value: 2, label: 'Sim, mas não no último ano' },
      { value: 4, label: 'Sim, no último ano' },
    ],
  },
  {
    text: 'Algum parente, amigo ou profissional já se preocupou com sua bebida ou sugeriu que você parasse?',
    options: [
      { value: 0, label: 'Não' },
      { value: 2, label: 'Sim, mas não no último ano' },
      { value: 4, label: 'Sim, no último ano' },
    ],
  },
];

export const AUDIT: ScaleDefinition = {
  type: 'AUDIT',
  title: 'AUDIT — Uso de Álcool',
  description: 'Questionário de identificação de consumo de álcool de risco.',
  maxScore: 40,
  questions: AUDIT_PROMPTS.map((q, i) => ({ id: i + 1, text: q.text, options: q.options })),
  calculateScore: (answers) => answers.reduce((sum, a) => sum + (a ?? 0), 0),
  classifySeverity: (score) => {
    if (score <= 7) return 'baixo risco';
    if (score <= 15) return 'uso de risco';
    if (score <= 19) return 'uso nocivo';
    return 'provável dependência';
  },
};

// ---------------------------------------------------------------------------
// MOCA (Montreal Cognitive Assessment) — versão simplificada de 30 pontos.
// OBS: O MOCA real exige aplicação presencial (desenhos, fluência, etc.).
// Aqui implementamos um stub que aceita um score direto para registro/histórico.
// ---------------------------------------------------------------------------
export const MOCA: ScaleDefinition = {
  type: 'MOCA',
  title: 'MOCA — Avaliação Cognitiva Montreal',
  description:
    'Score direto (0-30) obtido em aplicação presencial do MOCA. Use este registro para histórico longitudinal.',
  maxScore: 30,
  questions: [
    {
      id: 1,
      text: 'Score total do MOCA (aplicação presencial, 0-30)',
      options: Array.from({ length: 31 }, (_, v) => ({ value: v, label: String(v) })),
    },
  ],
  calculateScore: (answers) => answers[0] ?? 0,
  classifySeverity: (score) => {
    if (score >= 26) return 'normal';
    if (score >= 18) return 'comprometimento leve';
    if (score >= 10) return 'comprometimento moderado';
    return 'comprometimento grave';
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const SCALES: Record<ScaleType, ScaleDefinition> = {
  PHQ9,
  GAD7,
  AUDIT,
  MOCA,
};

export function getScaleDefinition(type: string): ScaleDefinition {
  const def = SCALES[type as ScaleType];
  if (!def) {
    throw new Error(`Escala desconhecida: ${type}. Suportadas: PHQ9, GAD7, AUDIT, MOCA.`);
  }
  return def;
}
