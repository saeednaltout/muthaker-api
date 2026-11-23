import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const outboxRunSchema = z
  .object({
    processed: z.number().int().meta({ example: 3 }),
    succeeded: z.number().int().meta({ example: 3 }),
    failed: z.number().int().meta({ example: 0 }),
    purged: z.number().int().meta({ example: 12 }),
  })
  .meta({ id: 'OutboxRunResult' });

export class OutboxRunDto extends createZodDto(outboxRunSchema) {}

export const cleanupRunSchema = z
  .object({
    refreshTokens: z.number().int().meta({ example: 40 }),
    verificationTokens: z.number().int().meta({ example: 5 }),
  })
  .meta({ id: 'CleanupRunResult' });

export class CleanupRunDto extends createZodDto(cleanupRunSchema) {}
