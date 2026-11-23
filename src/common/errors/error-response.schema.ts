import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const errorResponseSchema = z
  .object({
    statusCode: z.number().int().meta({ example: 400 }),
    code: z.string().meta({ example: 'VALIDATION_FAILED' }),
    message: z.string().meta({ example: 'Validation failed' }),
    details: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        example: { issues: [{ path: 'email', code: 'invalid_format', message: 'Invalid email' }] },
      }),
    requestId: z.string().meta({ example: '7b0c3f3e-1d7a-4a4b-9a8e-2f5e1c9b2d11' }),
  })
  .meta({
    id: 'ErrorResponse',
    // Full example: keeps generated docs/Postman examples deterministic.
    example: {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: { issues: [{ path: 'email', code: 'invalid_format', message: 'Invalid email' }] },
      requestId: '7b0c3f3e-1d7a-4a4b-9a8e-2f5e1c9b2d11',
    },
  });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}
