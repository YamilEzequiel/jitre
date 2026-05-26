/**
 * RFC 7807-style problem JSON payload returned by the API on error.
 */
export interface IProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
}
