import { getPostAuthRedirectPath } from '../post-auth-redirect';

function makeFakeJwtPayload(role: 'DOCTOR' | 'PATIENT', sub = 1): string {
  const payload = btoa(JSON.stringify({ sub, role, email: 'u@test.com' }));
  return `header.${payload}.sig`;
}

describe('getPostAuthRedirectPath', () => {
  it('retorna /dashboard/doctor para papel DOCTOR', () => {
    expect(getPostAuthRedirectPath(makeFakeJwtPayload('DOCTOR'))).toBe('/dashboard/doctor');
  });

  it('retorna / para papel PATIENT', () => {
    expect(getPostAuthRedirectPath(makeFakeJwtPayload('PATIENT'))).toBe('/');
  });
});
