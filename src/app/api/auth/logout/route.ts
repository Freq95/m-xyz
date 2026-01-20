import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthorizationError } from '@/lib/errors';
import { validateOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection - validate request origin
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const supabase = await createClient();

    // Sign out from Supabase Auth (clears session cookies)
    await supabase.auth.signOut();

    return successResponse({
      message: 'Ai fost deconectat cu succes',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
