import { ForbiddenException } from '@nestjs/common';

export class AiFeatureDisabledException extends ForbiddenException {
  constructor(featureKey: string) {
    super({
      message: `AI feature disabled: ${featureKey}`,
      code: 'AI_FEATURE_DISABLED',
      featureKey,
    });
  }
}
