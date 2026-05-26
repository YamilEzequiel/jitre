import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomFieldType } from '@jitre/shared';

export interface FieldDefinitionLike {
  type: CustomFieldType;
  required: boolean;
  options?: string[] | null;
}

/**
 * Validates a single custom field value against its definition.
 * Throws BadRequestException with a descriptive code if invalid.
 */
@Injectable()
export class CustomFieldValidator {
  validate(definition: FieldDefinitionLike, value: unknown): void {
    // Required check first
    if (value === null || value === undefined) {
      if (definition.required) {
        throw new BadRequestException(`CUSTOM_FIELD_REQUIRED`);
      }
      return; // null/undefined ok for optional fields
    }

    switch (definition.type) {
      case CustomFieldType.TEXT:
        if (typeof value !== 'string') {
          throw new BadRequestException(`CUSTOM_FIELD_TEXT_REQUIRES_STRING`);
        }
        break;

      case CustomFieldType.NUMBER:
        if (typeof value !== 'number') {
          throw new BadRequestException(`CUSTOM_FIELD_NUMBER_REQUIRES_NUMBER`);
        }
        break;

      case CustomFieldType.BOOLEAN:
        if (typeof value !== 'boolean') {
          throw new BadRequestException(
            `CUSTOM_FIELD_BOOLEAN_REQUIRES_BOOLEAN`,
          );
        }
        break;

      case CustomFieldType.DATE: {
        if (typeof value !== 'string') {
          throw new BadRequestException(`CUSTOM_FIELD_DATE_REQUIRES_STRING`);
        }
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          throw new BadRequestException(`CUSTOM_FIELD_DATE_INVALID_FORMAT`);
        }
        break;
      }

      case CustomFieldType.SELECT: {
        const opts = definition.options ?? [];
        if (!opts.includes(value as string)) {
          throw new BadRequestException(
            `CUSTOM_FIELD_SELECT_INVALID_OPTION: "${typeof value === 'string' ? value : JSON.stringify(value)}" not in [${opts.join(', ')}]`,
          );
        }
        break;
      }

      case CustomFieldType.MULTI_SELECT: {
        if (!Array.isArray(value)) {
          throw new BadRequestException(
            `CUSTOM_FIELD_MULTI_SELECT_REQUIRES_ARRAY`,
          );
        }
        const opts = definition.options ?? [];
        const invalid = (value as string[]).filter((v) => !opts.includes(v));
        if (invalid.length > 0) {
          throw new BadRequestException(
            `CUSTOM_FIELD_MULTI_SELECT_INVALID_OPTIONS: [${invalid.join(', ')}]`,
          );
        }
        break;
      }

      case CustomFieldType.USER:
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `CUSTOM_FIELD_USER_REQUIRES_STRING_UUID`,
          );
        }
        break;

      default:
        throw new BadRequestException(`CUSTOM_FIELD_UNKNOWN_TYPE`);
    }
  }
}
