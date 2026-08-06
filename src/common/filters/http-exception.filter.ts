import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches everything (not just HttpException) so an unexpected error (a bug,
 * a DB hiccup) gets the same envelope as a deliberate 4xx instead of
 * Nest's bare default 500 page. Stack traces are only ever attached in
 * development - in production they'd hand API clients file paths and
 * internal implementation details for free.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body = isHttpException ? exception.getResponse() : null;
    const responsePayload = isHttpException
      ? typeof body === 'string'
        ? { message: body }
        : body
      : { message: 'Internal server error' };

    const isProduction = process.env.NODE_ENV === 'production';
    const stack = !isProduction && exception instanceof Error ? exception.stack : undefined;

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...responsePayload,
      ...(stack ? { stack } : {}),
    });
  }
}
