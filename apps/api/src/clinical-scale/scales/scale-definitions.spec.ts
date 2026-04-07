import { PHQ9, GAD7, AUDIT, MOCA, getScaleDefinition, SCALES } from './scale-definitions';

describe('scale-definitions', () => {
  describe('PHQ-9', () => {
    it('tem 9 perguntas e maxScore 27', () => {
      expect(PHQ9.questions).toHaveLength(9);
      expect(PHQ9.maxScore).toBe(27);
    });

    it('soma respostas corretamente', () => {
      expect(PHQ9.calculateScore([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
      expect(PHQ9.calculateScore([3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(27);
      expect(PHQ9.calculateScore([1, 1, 2, 2, 1, 0, 0, 1, 0])).toBe(8);
    });

    it('classifica severidade nos limites esperados', () => {
      expect(PHQ9.classifySeverity(0)).toBe('mínima');
      expect(PHQ9.classifySeverity(4)).toBe('mínima');
      expect(PHQ9.classifySeverity(5)).toBe('leve');
      expect(PHQ9.classifySeverity(9)).toBe('leve');
      expect(PHQ9.classifySeverity(10)).toBe('moderada');
      expect(PHQ9.classifySeverity(14)).toBe('moderada');
      expect(PHQ9.classifySeverity(15)).toBe('moderadamente grave');
      expect(PHQ9.classifySeverity(19)).toBe('moderadamente grave');
      expect(PHQ9.classifySeverity(20)).toBe('grave');
      expect(PHQ9.classifySeverity(27)).toBe('grave');
    });
  });

  describe('GAD-7', () => {
    it('tem 7 perguntas e maxScore 21', () => {
      expect(GAD7.questions).toHaveLength(7);
      expect(GAD7.maxScore).toBe(21);
    });

    it('classificação de severidade GAD-7', () => {
      expect(GAD7.classifySeverity(3)).toBe('mínima');
      expect(GAD7.classifySeverity(7)).toBe('leve');
      expect(GAD7.classifySeverity(12)).toBe('moderada');
      expect(GAD7.classifySeverity(16)).toBe('grave');
    });
  });

  describe('AUDIT', () => {
    it('tem 10 perguntas e maxScore 40', () => {
      expect(AUDIT.questions).toHaveLength(10);
      expect(AUDIT.maxScore).toBe(40);
    });

    it('classificação AUDIT por faixas', () => {
      expect(AUDIT.classifySeverity(0)).toBe('baixo risco');
      expect(AUDIT.classifySeverity(7)).toBe('baixo risco');
      expect(AUDIT.classifySeverity(8)).toBe('uso de risco');
      expect(AUDIT.classifySeverity(15)).toBe('uso de risco');
      expect(AUDIT.classifySeverity(16)).toBe('uso nocivo');
      expect(AUDIT.classifySeverity(19)).toBe('uso nocivo');
      expect(AUDIT.classifySeverity(20)).toBe('provável dependência');
      expect(AUDIT.classifySeverity(40)).toBe('provável dependência');
    });
  });

  describe('MOCA', () => {
    it('aceita score direto 0-30', () => {
      expect(MOCA.maxScore).toBe(30);
      expect(MOCA.calculateScore([26])).toBe(26);
    });

    it('classificação MOCA por cutoffs', () => {
      expect(MOCA.classifySeverity(28)).toBe('normal');
      expect(MOCA.classifySeverity(26)).toBe('normal');
      expect(MOCA.classifySeverity(25)).toBe('comprometimento leve');
      expect(MOCA.classifySeverity(18)).toBe('comprometimento leve');
      expect(MOCA.classifySeverity(15)).toBe('comprometimento moderado');
      expect(MOCA.classifySeverity(9)).toBe('comprometimento grave');
    });
  });

  describe('getScaleDefinition', () => {
    it('retorna a escala correspondente para cada tipo', () => {
      expect(getScaleDefinition('PHQ9')).toBe(PHQ9);
      expect(getScaleDefinition('GAD7')).toBe(GAD7);
      expect(getScaleDefinition('AUDIT')).toBe(AUDIT);
      expect(getScaleDefinition('MOCA')).toBe(MOCA);
    });

    it('lança erro para tipo desconhecido', () => {
      expect(() => getScaleDefinition('BDI')).toThrow(/Escala desconhecida/);
    });
  });

  it('SCALES expõe todas as 4 escalas', () => {
    expect(Object.keys(SCALES).sort()).toEqual(['AUDIT', 'GAD7', 'MOCA', 'PHQ9']);
  });
});
