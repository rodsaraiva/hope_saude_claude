import { sanitizeMedicalHtml } from './html-sanitizer';

describe('sanitizeMedicalHtml', () => {
  it('remove tags <script>', () => {
    const dirty = '<p>ok</p><script>alert(1)</script>';
    expect(sanitizeMedicalHtml(dirty)).toBe('<p>ok</p>');
  });

  it('remove handlers inline (onerror/onclick)', () => {
    const dirty = '<img src=x onerror="alert(1)"><p onclick="x()">t</p>';
    const clean = sanitizeMedicalHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
  });

  it('remove javascript: em href de link', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    expect(sanitizeMedicalHtml(dirty)).not.toContain('javascript:');
  });

  it('preserva formatação clínica do Tiptap (strong, p, ul, li)', () => {
    const dirty = '<p><strong>S (Subjetivo):</strong></p><ul><li>queixa</li></ul>';
    expect(sanitizeMedicalHtml(dirty)).toBe(dirty);
  });

  it('preserva null/undefined', () => {
    expect(sanitizeMedicalHtml(null)).toBeNull();
    expect(sanitizeMedicalHtml(undefined)).toBeUndefined();
  });
});
