import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ABILITY_KEY = 'requireAbility';
export const RequireAbility = (fn: (ability: unknown) => boolean) =>
  SetMetadata(REQUIRE_ABILITY_KEY, fn);
