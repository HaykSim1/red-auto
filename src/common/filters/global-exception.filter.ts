import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiException } from '../exceptions/api.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { code: string; message: string; details?: unknown } = {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    };

    if (exception instanceof ApiException) {
      const r = exception.getResponse();
      status = exception.getStatus();
      if (typeof r === 'object' && r !== null && 'code' in r) {
        body = r as typeof body;
      } else {
        body = {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        };
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'string') {
        body = {
          code: this.statusToCode(status),
          message: r,
        };
      } else if (typeof r === 'object' && r !== null) {
        const o = r as Record<string, unknown>;
        body = {
          code: typeof o.code === 'string' ? o.code : this.statusToCode(status),
          message:
            typeof o.message === 'string'
              ? o.message
              : Array.isArray(o.message)
                ? (o.message as string[]).join('; ')
                : exception.message,
          details: o.details,
        };
      }
    } else if (exception instanceof QueryFailedError) {
      const pg = exception as QueryFailedError & { code?: string };
      if (pg.code === '23505') {
        status = HttpStatus.CONFLICT;
        body = {
          code: 'duplicate',
          message: 'Resource already exists.',
        };
      } else {
        this.logger.warn(
          `${req.method} ${req.url} QueryFailedError: ${exception.message}`,
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `${req.method} ${req.url} ${exception.name}: ${exception.message}`,
        exception.stack,
      );
    }

    res.status(status).json(body);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'bad_request';
      case HttpStatus.UNAUTHORIZED:
        return 'unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'forbidden';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.CONFLICT:
        return 'conflict';
      default:
        return 'error';
    }
  }
}
