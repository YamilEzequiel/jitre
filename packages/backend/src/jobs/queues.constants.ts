export const QUEUES = {
  DEFAULT: 'default',
  EMAIL: 'email',
  CLEANUP: 'cleanup',
  SEARCH_INDEXER: 'search-indexer',
  ANALYTICS: 'analytics',
  AI: 'ai',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOB_NAMES = {
  ATTACHMENTS_CLEANUP_SOFT_DELETED: 'attachments.cleanup-soft-deleted',
  ENTITY_INDEX: 'entity.index',
  EMAIL_DRAIN: 'email.drain',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

/** Injection token for the Bull Board Express adapter. */
export const BULL_BOARD_ADAPTER = 'BULL_BOARD_ADAPTER';
