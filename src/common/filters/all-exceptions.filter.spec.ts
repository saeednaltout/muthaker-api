import {
  type ArgumentsHost,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';

import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { AllExceptionsFilter } from './all-exceptions.filter';

const req = { id: 'req-1', headers: {} } as unknown as Request & { id: string };

function hostFor() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('maps AppException with code and details', () => {
    const body = filter.toBody(
      AppException.badRequest(ErrorCode.STORAGE_FILE_TOO_LARGE, 'Too big', { maxSize: 1 }),
      req,
    );
    expect(body).toEqual({
      statusCode: 400,
      code: 'STORAGE_FILE_TOO_LARGE',
      message: 'Too big',
      details: { maxSize: 1 },
      requestId: 'req-1',
    });
  });

  it('maps zod validation errors to VALIDATION_FAILED with issues', () => {
    const result = z.object({ email: z.email() }).safeParse({ email: 'x' });
    if (result.success) throw new Error('expected failure');
    const body = filter.toBody(new ZodValidationException(result.error), req);
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual({
      issues: [expect.objectContaining({ path: 'email', code: 'invalid_format' })],
    });
  });

  it('hides serialization errors behind a generic 500', () => {
    const result = z.string().safeParse(1);
    if (result.success) throw new Error('expected failure');
    const body = filter.toBody(new ZodSerializationException(result.error), req);
    expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  it('maps plain Nest HttpExceptions by status', () => {
    expect(filter.toBody(new ForbiddenException(), req).code).toBe('FORBIDDEN');
    expect(filter.toBody(new NotFoundException('User not found'), req).code).toBe('NOT_FOUND');
    expect(filter.toBody(new NotFoundException('Cannot GET /x'), req).code).toBe('ROUTE_NOT_FOUND');
  });

  it('never leaks 5xx messages', () => {
    const body = filter.toBody(new InternalServerErrorException('db password is x'), req);
    expect(body).toMatchObject({ statusCode: 500, message: 'Internal server error' });
  });

  it('maps unknown errors to 500 and writes the response', () => {
    const { host, status, json } = hostFor();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('falls back to the x-request-id header', () => {
    const r = { headers: { 'x-request-id': 'hdr-1' } } as unknown as Request & { id?: string };
    expect(filter.toBody(new ForbiddenException(), r).requestId).toBe('hdr-1');
  });
});
