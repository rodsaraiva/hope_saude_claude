import type { Request as ExpressRequest } from 'express';
import type { UserRole } from './auth.types';

/**
 * Shape do objeto que o Passport/JwtStrategy anexa em `req.user`
 * via AuthGuard('jwt'). Todos os controllers autenticados devem
 * tipar seus `@Request()` com este type.
 */
export interface AuthenticatedUser {
  userId: number;
  email?: string;
  role: UserRole;
  name?: string;
}

export interface AuthenticatedRequest extends ExpressRequest {
  user: AuthenticatedUser;
}
