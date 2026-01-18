import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, ValidationError } from './index';

/**
 * Standard API response format
 */
interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  meta?: { cursor?: string; hasMore?: boolean }
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, ...(meta && { meta }) });
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', error);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(err.message);
    });

    return NextResponse.json(
      {
        error: 'Datele introduse nu sunt valide',
        code: 'VALIDATION_ERROR',
        details: errors,
      },
      { status: 400 }
    );
  }

  // Known API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error instanceof ValidationError && { details: error.errors }),
      },
      { status: error.statusCode }
    );
  }

  // Unknown errors
  console.error('Unhandled error:', error);

  return NextResponse.json(
    {
      error: 'A apărut o eroare internă',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}
