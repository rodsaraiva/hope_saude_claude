import * as sanitizeHtml from 'sanitize-html';

/**
 * Sanitiza HTML de prontuário (gerado pelo Tiptap) antes de persistir.
 * Whitelist mínima das tags/atributos que o editor produz; remove
 * <script>, handlers inline e protocolos perigosos (XSS armazenado).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'a',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeMedicalHtml<T extends string | null | undefined>(html: T): T {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(html, OPTIONS) as T;
}
