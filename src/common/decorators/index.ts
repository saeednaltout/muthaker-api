import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import type { Role, UserStatus } from '../../generated/prisma/enums';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Marks a route as not requiring authentication (honoured by the auth guard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Shape attached to `req.user` by the auth guard (implemented in the Auth feature). */
export interface AuthUser {
  id: string;
  role: Role;
  status: UserStatus;
}

export type RequestWithUser = Request & { user?: AuthUser };

/** Injects the authenticated user (`req.user`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<RequestWithUser>().user,
);
