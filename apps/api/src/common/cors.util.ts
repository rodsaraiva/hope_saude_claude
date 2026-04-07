/**
 * Converte a variável CORS_ORIGINS (string separada por vírgula) em lista de origins.
 * Retorna `true` (libera tudo) somente em ausência absoluta de config — não use em prod.
 */
export function parseCorsOrigins(raw: string | undefined): string[] | boolean {
  if (!raw || raw.trim() === '') {
    return true; // fallback permissivo só para dev sem env configurado
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}
