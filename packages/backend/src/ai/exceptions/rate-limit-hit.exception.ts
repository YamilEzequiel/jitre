import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitHitException extends HttpException {
  constructor(limitType: 'USER_DAILY_REQUESTS' | 'WORKSPACE_DAILY_REQUESTS') {
    super(
      {
        message: `AI rate limit exceeded: ${limitType}`,
        code: 'AI_RATE_LIMIT_HIT',
        limitType,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
