/**
 * Converte a variável CORS_ORIGINS (string separada por vírgula) em lista de origins.
 * Em produção sem config, retorna [] (fail-closed). Fora de produção sem config,
 * retorna `true` (libera tudo) só para conveniência de dev.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] | boolean {
  const list = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (list.length === 0) {
    return nodeEnv === 'production' ? [] : true;
  }
  return list;
}
