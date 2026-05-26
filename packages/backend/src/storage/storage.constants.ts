export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

export const STORAGE_DRIVER_DEFAULTS = {
  LOCAL_ROOT: './uploads',
  MAX_FILE_SIZE_MB: 25,
  PUBLIC_BASE_URL: 'http://localhost:3000/api/v1/files',
  SIGNED_URL_TTL_SECONDS: 300,
} as const;
