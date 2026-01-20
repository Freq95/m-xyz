/**
 * Fetch wrapper with timeout support
 * Prevents hanging requests from blocking the UI indefinitely
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Cererea a expirat. Verifică conexiunea la internet și încearcă din nou.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Helper for JSON POST requests with timeout
 */
export async function postJSON<T = unknown>(
  url: string,
  data: unknown,
  options: FetchWithTimeoutOptions = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });

  const json = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data: json as T,
  };
}
