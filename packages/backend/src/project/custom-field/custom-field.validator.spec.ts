import { CustomFieldValidator } from './custom-field.validator';
import { CustomFieldType } from '@jitre/shared';

describe('CustomFieldValidator', () => {
  let validator: CustomFieldValidator;

  beforeEach(() => {
    validator = new CustomFieldValidator();
  });

  describe('TEXT', () => {
    it('accepts a string value', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.TEXT, required: false },
          'hello',
        ),
      ).not.toThrow();
    });

    it('rejects a number value', () => {
      expect(() =>
        validator.validate({ type: CustomFieldType.TEXT, required: false }, 42),
      ).toThrow();
    });
  });

  describe('NUMBER', () => {
    it('accepts a numeric value', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.NUMBER, required: false },
          3.14,
        ),
      ).not.toThrow();
    });

    it('rejects a string value', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.NUMBER, required: false },
          'not-a-number',
        ),
      ).toThrow();
    });
  });

  describe('BOOLEAN', () => {
    it('accepts true', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.BOOLEAN, required: false },
          true,
        ),
      ).not.toThrow();
    });

    it('rejects string "true"', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.BOOLEAN, required: false },
          'true',
        ),
      ).toThrow();
    });
  });

  describe('DATE', () => {
    it('accepts ISO date string', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.DATE, required: false },
          '2024-01-15',
        ),
      ).not.toThrow();
    });

    it('rejects non-date string', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.DATE, required: false },
          'not-a-date',
        ),
      ).toThrow();
    });
  });

  describe('SELECT', () => {
    it('accepts a value that is in the options array', () => {
      expect(() =>
        validator.validate(
          {
            type: CustomFieldType.SELECT,
            options: ['Low', 'Medium', 'High'],
            required: false,
          },
          'Low',
        ),
      ).not.toThrow();
    });

    it('rejects a value not in the options array', () => {
      expect(() =>
        validator.validate(
          {
            type: CustomFieldType.SELECT,
            options: ['Low', 'Medium', 'High'],
            required: false,
          },
          'Critical',
        ),
      ).toThrow();
    });
  });

  describe('MULTI_SELECT', () => {
    it('accepts an array of valid options', () => {
      expect(() =>
        validator.validate(
          {
            type: CustomFieldType.MULTI_SELECT,
            options: ['A', 'B', 'C'],
            required: false,
          },
          ['A', 'C'],
        ),
      ).not.toThrow();
    });

    it('rejects if any value is not in the options array', () => {
      expect(() =>
        validator.validate(
          {
            type: CustomFieldType.MULTI_SELECT,
            options: ['A', 'B', 'C'],
            required: false,
          },
          ['A', 'D'],
        ),
      ).toThrow();
    });

    it('rejects if value is not an array', () => {
      expect(() =>
        validator.validate(
          {
            type: CustomFieldType.MULTI_SELECT,
            options: ['A', 'B'],
            required: false,
          },
          'A',
        ),
      ).toThrow();
    });
  });

  describe('USER', () => {
    it('accepts a UUID string', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.USER, required: false },
          '550e8400-e29b-41d4-a716-446655440000',
        ),
      ).not.toThrow();
    });

    it('rejects a non-string value', () => {
      expect(() =>
        validator.validate({ type: CustomFieldType.USER, required: false }, 42),
      ).toThrow();
    });
  });

  describe('required field', () => {
    it('throws when value is null and field is required', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.TEXT, required: true },
          null,
        ),
      ).toThrow();
    });

    it('throws when value is undefined and field is required', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.TEXT, required: true },
          undefined,
        ),
      ).toThrow();
    });

    it('passes when value is null and field is NOT required', () => {
      expect(() =>
        validator.validate(
          { type: CustomFieldType.TEXT, required: false },
          null,
        ),
      ).not.toThrow();
    });
  });
});
