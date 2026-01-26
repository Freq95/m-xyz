/**
 * Get user-friendly error message from API response
 */
export function getErrorMessage(error: unknown): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If it's an Error object
  if (error instanceof Error) {
    return error.message;
  }

  // If it's a fetch response error
  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = error as { error?: string; message?: string };
    return apiError.error || apiError.message || 'A apărut o eroare';
  }

  // Default fallback
  return 'A apărut o eroare neașteptată';
}

/**
 * Common user-friendly error messages in Romanian
 */
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: 'Eroare de conexiune. Verifică conexiunea la internet.',
  TIMEOUT: 'Cererea a expirat. Încearcă din nou.',

  // Authentication errors
  AUTHENTICATION_ERROR: 'Trebuie să fii autentificat pentru această acțiune.',
  INVALID_CREDENTIALS: 'Email sau parolă incorectă.',
  SESSION_EXPIRED: 'Sesiunea ta a expirat. Te rugăm să te autentifici din nou.',

  // Authorization errors
  AUTHORIZATION_ERROR: 'Nu ai permisiunea să efectuezi această acțiune.',
  FORBIDDEN: 'Acces interzis.',

  // Validation errors
  VALIDATION_ERROR: 'Datele introduse nu sunt valide.',
  REQUIRED_FIELD: 'Acest câmp este obligatoriu.',
  INVALID_EMAIL: 'Adresa de email nu este validă.',
  INVALID_PASSWORD: 'Parola trebuie să aibă cel puțin 8 caractere.',

  // Resource errors
  NOT_FOUND: 'Resursa nu a fost găsită.',
  ALREADY_EXISTS: 'Resursa există deja.',

  // Rate limiting
  RATE_LIMIT: 'Prea multe cereri. Te rugăm să aștepți puțin.',

  // Server errors
  INTERNAL_ERROR: 'A apărut o eroare internă. Încearcă din nou mai târziu.',
  SERVICE_UNAVAILABLE: 'Serviciul nu este disponibil momentan.',

  // Generic
  UNKNOWN_ERROR: 'A apărut o eroare neașteptată.',
  TRY_AGAIN: 'Ceva nu a mers bine. Încearcă din nou.',
} as const;

/**
 * Get message by error code
 */
export function getMessageByCode(code: string): string {
  return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Format validation errors into a readable message
 */
export function formatValidationErrors(details?: Record<string, string[]>): string {
  if (!details || Object.keys(details).length === 0) {
    return ERROR_MESSAGES.VALIDATION_ERROR;
  }

  const messages = Object.entries(details)
    .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
    .join('\n');

  return messages || ERROR_MESSAGES.VALIDATION_ERROR;
}

/**
 * Parse API error response and return user-friendly message
 */
export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();

    if (data.error) {
      return data.error;
    }

    if (data.code) {
      return getMessageByCode(data.code);
    }

    if (data.details) {
      return formatValidationErrors(data.details);
    }
  } catch {
    // Failed to parse JSON
  }

  // Fallback based on status code
  switch (response.status) {
    case 400:
      return ERROR_MESSAGES.VALIDATION_ERROR;
    case 401:
      return ERROR_MESSAGES.AUTHENTICATION_ERROR;
    case 403:
      return ERROR_MESSAGES.AUTHORIZATION_ERROR;
    case 404:
      return ERROR_MESSAGES.NOT_FOUND;
    case 409:
      return ERROR_MESSAGES.ALREADY_EXISTS;
    case 429:
      return ERROR_MESSAGES.RATE_LIMIT;
    case 500:
    case 502:
    case 503:
      return ERROR_MESSAGES.INTERNAL_ERROR;
    default:
      return ERROR_MESSAGES.UNKNOWN_ERROR;
  }
}

/**
 * Handle fetch errors and return user-friendly message
 */
export function handleFetchError(error: unknown): string {
  if (error instanceof TypeError) {
    // Network error or CORS issue
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  return getErrorMessage(error);
}
