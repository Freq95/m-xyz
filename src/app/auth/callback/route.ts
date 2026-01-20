import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Update email verification timestamp and get neighborhood status
      const user = await prisma.user.update({
        where: { id: data.user.id },
        data: { emailVerifiedAt: new Date() },
        select: { neighborhoodId: true },
      });

      // Redirect based on neighborhood status
      const redirectPath = user.neighborhoodId ? '/feed' : '/onboarding';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  // Redirect to login on error
  return NextResponse.redirect(new URL('/login?error=verification-failed', request.url));
}
