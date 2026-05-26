import { HttpException, HttpStatus } from '@nestjs/common';

export class AiResponseInvalidException extends HttpException {
  constructor(detail?: string) {
    super(
      {
        message: `AI response could not be parsed: ${detail ?? 'invalid format'}`,
        code: 'AI_RESPONSE_INVALID',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
