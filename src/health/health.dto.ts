import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const healthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']).meta({ example: 'ok' }),
    db: z.enum(['up', 'down']).meta({ example: 'up' }),
    version: z.string().meta({ example: '0.1.0' }),
  })
  .meta({ id: 'Health' });

export class HealthDto extends createZodDto(healthSchema) {}
