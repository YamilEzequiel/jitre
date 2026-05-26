import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANCY_KEY = 'skipTenancy';
export const SkipTenancy = () => SetMetadata(SKIP_TENANCY_KEY, true);
