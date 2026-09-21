import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns a failed request into the wording the query panes display.
 *
 * Status 0 means the request never reached a server (or CORS blocked it).
 * Under `ng serve` it never gets that far: proxy.conf.js catches the refused
 * connection and answers 503 with a sentinel body, so both look the same here.
 */
export function describeHttpError(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) { return 'server unreachable'; }

  const offline = err.status === 0 ||
    (err.status === 503 && parseBody(err.error)?.status === 'offline');

  return offline ? 'server unreachable' : `request failed with status ${err.status}`;
}

/** HttpClient leaves the body as a string when a non-2xx response can't be parsed. */
function parseBody(body: unknown): { status?: string } | null {
  if (body && typeof body === 'object') { return body as { status?: string }; }
  if (typeof body !== 'string') { return null; }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
