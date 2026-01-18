/**
 * Base API error class
 */
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

/**
 * Validation error - 400
 */
export class ValidationError extends ApiError {
  public errors?: Record<string, string[]>;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(400, message, 'VALIDATION_ERROR');
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error - 401
 */
export class AuthenticationError extends ApiError {
  constructor(message = 'Trebuie să fii autentificat') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error - 403
 */
export class AuthorizationError extends ApiError {
  constructor(message = 'Nu ai permisiunea să faci această acțiune') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error - 404
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resursa') {
    super(404, `${resource} nu a fost găsită`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error - 409
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error - 429
 */
export class RateLimitError extends ApiError {
  public retryAfter?: number;

  constructor(retryAfter?: number) {
    super(429, 'Prea multe cereri. Încearcă din nou mai târziu.', 'RATE_LIMIT');
    this.retryAfter = retryAfter;
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error - 500
 */
export class InternalServerError extends ApiError {
  constructor(message = 'A apărut o eroare internă') {
    super(500, message, 'INTERNAL_ERROR');
    this.name = 'InternalServerError';
  }
}
