import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthorizationPendingException extends HttpException {
  constructor(pollIntervalSeconds: number) {
    super({ error: 'authorization_pending', pollIntervalSeconds }, HttpStatus.PRECONDITION_REQUIRED);
  }
}

export class SlowDownException extends HttpException {
  constructor(pollIntervalSeconds: number) {
    super({ error: 'slow_down', pollIntervalSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class PairingExpiredException extends HttpException {
  constructor() {
    super({ error: 'expired' }, HttpStatus.GONE);
  }
}
