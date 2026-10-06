export class HttpTimeoutError extends Error {
  constructor(message = 'HTTP request timed out') {
    super(message);
    this.name = 'HttpTimeoutError';
  }
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new HttpTimeoutError(`Request exceeded ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function readResponseBody(response: Response): Promise<{
  data?: unknown;
  text: string;
}> {
  const text = await response.text();
  if (!text) return { text: '' };

  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { text };
  }
}
