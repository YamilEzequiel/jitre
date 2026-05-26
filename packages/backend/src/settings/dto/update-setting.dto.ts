import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { KNOWN_KEYS_FLAT } from '../settings-keys.constants';

export class UpdateSettingDto {
  @IsIn(KNOWN_KEYS_FLAT)
  key!: string;

  @IsNotEmpty()
  value!: unknown;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}
