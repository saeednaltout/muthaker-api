import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../src/common/utils/password';
import { generatePublicCode } from '../../src/common/utils/public-code';
import type { Role, User, UserStatus } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_PASSWORD = 'Test-Password-123!';

export interface CreateUserInput {
  role?: Role;
  status?: UserStatus;
  email?: string;
  name?: string;
  password?: string | null;
  locale?: 'ar' | 'en';
}

/**
 * Creates a user with FAKE data. Defaults: STUDENT, ACTIVE, verified, onboarded.
 * Login helpers (cookies per role) are added with the Auth & Roles feature:
 *   loginAs(server, user) → string[] (Set-Cookie)
 */
export async function createUser(
  prisma: PrismaService,
  input: CreateUserInput = {},
): Promise<User> {
  const role = input.role ?? 'STUDENT';
  const now = new Date();
  return prisma.user.create({
    data: {
      email: input.email ?? `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`,
      name: input.name ?? `Test ${role.toLowerCase()}`,
      passwordHash:
        input.password === null ? null : await hashPassword(input.password ?? TEST_PASSWORD),
      role,
      status: input.status ?? (role === 'SUPERVISOR' ? 'PENDING_APPROVAL' : 'ACTIVE'),
      publicCode: generatePublicCode(),
      locale: input.locale ?? 'ar',
      emailVerifiedAt: now,
      onboardingCompletedAt: now,
    },
  });
}

export const createStudent = (p: PrismaService, i: CreateUserInput = {}) =>
  createUser(p, { ...i, role: 'STUDENT' });
export const createSupervisor = (p: PrismaService, i: CreateUserInput = {}) =>
  createUser(p, { status: 'ACTIVE', ...i, role: 'SUPERVISOR' });
export const createAdmin = (p: PrismaService, i: CreateUserInput = {}) =>
  createUser(p, { ...i, role: 'ADMIN' });
