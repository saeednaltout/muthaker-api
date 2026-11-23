/**
 * Seeds the ADMIN account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * ADMIN is never selectable at signup; this is the only way to create one.
 * Idempotent: running it again does not change an existing admin's password.
 * Uses fake/local data only — never real student data.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { hashPassword } from '../src/common/utils/password';
import { generatePublicCode } from '../src/common/utils/public-code';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!url) throw new Error('DIRECT_URL (or DATABASE_URL) is required');
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must have at least 12 characters');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        throw new Error(`User ${email} exists but is not an ADMIN; refusing to promote it.`);
      }
      process.stdout.write(`Admin ${email} already exists, nothing to do.\n`);
      return;
    }

    const now = new Date();
    await prisma.user.create({
      data: {
        email,
        name: 'Admin',
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        status: 'ACTIVE',
        publicCode: generatePublicCode(),
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
      },
    });
    process.stdout.write(`Admin ${email} created.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
