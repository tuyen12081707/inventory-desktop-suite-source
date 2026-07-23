import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const payload = typeof raw === 'string' ? { message: raw } : (raw as Record<string, unknown>);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      code: payload.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: payload.message ?? 'Có lỗi xảy ra',
      issues: payload.issues,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
