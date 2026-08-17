import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface ApiResponseEnvelope<T> {
  statusCode: number;
  message: string;
  data: T | null;
}

const DEFAULT_MESSAGES_BY_METHOD: Record<string, string> = {
  GET: 'Request successful',
  POST: 'Resource created successfully',
  PATCH: 'Resource updated successfully',
  PUT: 'Resource updated successfully',
  DELETE: 'Resource deleted successfully',
};

/**
 * Wraps every successful response in { statusCode, message, data }. Must run
 * AFTER ClassSerializerInterceptor strips @Exclude()-marked fields (e.g.
 * Employee.passwordHash) — so this is registered FIRST in main.ts, since
 * global interceptors apply their post-handler transform in reverse
 * registration order (the last-registered interceptor sees the raw handler
 * output first).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseEnvelope<T> | T> {
  constructor(private reflector: Reflector) {}

  public intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponseEnvelope<T> | T> {
    const http = context.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    return next.handle().pipe(
      map((data) => {
        // A 204 must carry no body, and a handler that already streamed its
        // own response (e.g. the .xlsx report export) must not be touched.
        if (response.statusCode === HttpStatus.NO_CONTENT || response.headersSent) {
          return data;
        }

        const customMessage = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);

        return {
          statusCode: response.statusCode,
          message: customMessage ?? DEFAULT_MESSAGES_BY_METHOD[request.method] ?? 'Request successful',
          data: data ?? null,
        };
      }),
    );
  }
}
