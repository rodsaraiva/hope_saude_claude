/**
 * Tipos compartilhados do domínio de autenticação.
 * Centraliza os shapes que antes eram `any` no AuthService.
 */

export type UserRole = 'DOCTOR' | 'PATIENT';

/** Payload aceito por createUser/registerAndLogin (antes de hash + persistência). */
export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/** Dados públicos do usuário (nunca inclui password). */
export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/** Shape mínimo exigido por login() — o que vai para o JWT. */
export interface JwtSigningPayload {
  id: number;
  email: string;
  role: UserRole;
}

/** Resposta padrão de rotas autenticadas (login/register). */
export interface AuthTokenResponse {
  access_token: string;
}
