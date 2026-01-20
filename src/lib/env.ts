/**
 * Environment variable validation
 * Validates required env vars at build time and runtime
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const requiredServerEnvVars = [
  'DATABASE_URL',
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type RequiredServerEnvVar = (typeof requiredServerEnvVars)[number];

/**
 * Validates that all required environment variables are set
 * Call this at app startup
 */
export function validateEnv(): void {
  const missing: string[] = [];

  // Check public env vars (available on client and server)
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check server-only env vars (only in server context)
  if (typeof window === 'undefined') {
    for (const envVar of requiredServerEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
  }

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}`
    );

    // In production, throw an error
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

/**
 * Get a required environment variable with type safety
 */
export function getEnv(key: RequiredEnvVar | RequiredServerEnvVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable
 */
export function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

// Validate on module load in server context
if (typeof window === 'undefined') {
  validateEnv();
}
