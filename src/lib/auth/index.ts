import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma/client';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  neighborhoodId: string | null;
}

/**
 * Get authenticated user from session
 * Throws AuthenticationError if not authenticated
 */
export async function getAuthUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser?.email) {
    throw new AuthenticationError();
  }

  const user = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
    select: {
      id: true,
      email: true,
      role: true,
      isBanned: true,
      neighborhoodId: true,
    },
  });

  if (!user) {
    throw new AuthenticationError();
  }

  if (user.isBanned) {
    throw new AuthorizationError('Contul tău a fost suspendat');
  }

  return user;
}

/**
 * Get authenticated admin user
 * Throws AuthorizationError if not admin
 */
export async function getAdminUser(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (user.role !== 'admin' && user.role !== 'moderator') {
    throw new AuthorizationError('Acces interzis');
  }

  return user;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'moderator';
}
