import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Role } from '../../generated/prisma/enums';
import { type RequestWithUser, ROLES_KEY } from '../decorators';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';

/**
 * Checks `@Roles(...)` metadata against `req.user.role`.
 * Authentication itself (populating req.user) is done by the auth guard of the Auth feature.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw AppException.unauthorized();
    if (!required.includes(user.role)) {
      throw AppException.forbidden('Insufficient role', ErrorCode.AUTH_INSUFFICIENT_ROLE);
    }
    return true;
  }
}
