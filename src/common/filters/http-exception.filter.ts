import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches everything (not just HttpException) so an unexpected error (a bug,
 * a DB hiccup) gets the same envelope as a deliberate 4xx instead of
 * Nest's bare default 500 page.
 *
 * Production responses are deliberately minimal — statusCode + message +
 * data:null, matching the success envelope shape from ResponseInterceptor —
 * so a client never sees a stack trace, request path, or other internal
 * detail. Non-production responses add path/timestamp/stack for local
 * debugging.
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
    const message = isHttpException
      ? typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ?? exception.message)
      : 'Internal server error';

    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      response.status(status).json({ statusCode: status, message, data: null });
      return;
    }

    response.status(status).json({
      statusCode: status,
      message,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
      stack: exception instanceof Error ? exception.stack : undefined,
    });
  }
}
