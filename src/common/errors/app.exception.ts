import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-codes';

export interface AppExceptionBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Throw this from services/controllers to return a translated, stable error:
 *   throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'Not the owner');
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details } satisfies AppExceptionBody, status);
    this.message = message;
  }

  static notFound(message = 'Resource not found', details?: Record<string, unknown>) {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message, details);
  }

  static forbidden(message = 'Forbidden', code: ErrorCode = ErrorCode.FORBIDDEN) {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static unauthorized(message = 'Unauthorized', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static badRequest(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, details);
  }
}
