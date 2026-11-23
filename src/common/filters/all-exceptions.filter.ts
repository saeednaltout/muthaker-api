import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { AppException } from '../errors/app.exception';
import { ErrorCode, statusToErrorCode } from '../errors/error-codes';
import type { ErrorResponse } from '../errors/error-response.schema';

type RequestWithId = Request & { id?: string | number };

/**
 * Single error format for the whole API:
 * { statusCode, code, message, details?, requestId }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const body = this.toBody(exception, req);

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId: body.requestId },
        exception instanceof Error ? exception.message : 'Unhandled exception',
      );
    }

    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown, req: RequestWithId): ErrorResponse {
    const headerId = req.headers['x-request-id'];
    const requestId = String(req.id ?? (typeof headerId === 'string' ? headerId : ''));

    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
        requestId,
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        details: { issues: zodError instanceof ZodError ? formatIssues(zodError) : [] },
        requestId,
      };
    }

    if (exception instanceof ZodSerializationException) {
      return internalError(requestId);
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode >= 500) return { ...internalError(requestId), statusCode };
      const isRouteNotFound = statusCode === 404 && exception.message.startsWith('Cannot ');
      return {
        statusCode,
        code: isRouteNotFound
          ? ErrorCode.ROUTE_NOT_FOUND
          : (statusToErrorCode[statusCode] ?? ErrorCode.BAD_REQUEST),
        message: exception.message,
        requestId,
      };
    }

    return internalError(requestId);
  }
}

function internalError(requestId: string): ErrorResponse {
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
    requestId,
  };
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export function formatIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code,
    message: issue.message,
  }));
}
