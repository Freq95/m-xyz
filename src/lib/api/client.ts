import { parseApiError, handleFetchError } from '@/lib/errors/messages';

/**
 * API Client with error handling
 * Use this for making API requests with consistent error handling
 */

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Make an API request with proper error handling
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    // Parse response
    const data: ApiResponse<T> = await response.json();

    // Handle error responses
    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      throw new ApiClientError(
        errorMessage,
        response.status,
        data.code,
        data.details
      );
    }

    // Return the data
    return data.data as T;
  } catch (error) {
    // Network errors, parsing errors, etc.
    if (error instanceof ApiClientError) {
      throw error;
    }

    const message = handleFetchError(error);
    throw new ApiClientError(message, 0);
  }
}

/**
 * Helper functions for common HTTP methods
 */

export async function apiGet<T = unknown>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'GET' });
}

export async function apiPost<T = unknown>(
  url: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T = unknown>(
  url: string,
  body?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE' });
}

/**
 * Example usage:
 *
 * try {
 *   const post = await apiGet<Post>('/api/posts/123');
 *   console.log(post);
 * } catch (error) {
 *   if (error instanceof ApiClientError) {
 *     toast.error(error.message);
 *   }
 * }
 */
