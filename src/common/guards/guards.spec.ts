import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { testConfig } from '../../../test/unit/config';
import type { AuthUser } from '../decorators';
import { CronSecretGuard } from './cron-secret.guard';
import { RolesGuard } from './roles.guard';

function ctx(req: object): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const student: AuthUser = { id: 'u1', role: 'STUDENT', status: 'ACTIVE' };

  afterEach(() => jest.restoreAllMocks());

  it('allows routes without @Roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctx({}))).toBe(true);
  });

  it('allows a user with a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['STUDENT', 'ADMIN']);
    expect(guard.canActivate(ctx({ user: student }))).toBe(true);
  });

  it('403 AUTH_INSUFFICIENT_ROLE for the wrong role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(ctx({ user: student }))).toThrow(
      expect.objectContaining({ code: 'AUTH_INSUFFICIENT_ROLE', status: 403 }),
    );
  });

  it('401 when no user is attached', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(ctx({}))).toThrow(expect.objectContaining({ status: 401 }));
  });
});

describe('CronSecretGuard', () => {
  const guard = new CronSecretGuard(testConfig({ CRON_SECRET: 's'.repeat(40) }));

  it('accepts the exact bearer secret', () => {
    const req = { headers: { authorization: `Bearer ${'s'.repeat(40)}` } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it.each([undefined, '', 'Bearer wrong', `${'s'.repeat(40)}`, `bearer ${'s'.repeat(40)}`])(
    'rejects %p',
    (authorization) => {
      expect(() => guard.canActivate(ctx({ headers: { authorization } }))).toThrow(
        expect.objectContaining({ code: 'CRON_UNAUTHORIZED', status: 401 }),
      );
    },
  );
});
