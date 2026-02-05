import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { uploadAvatar, deleteAvatar } from '@/lib/supabase/storage';
import prisma from '@/lib/prisma/client';
import { invalidateFeedCache } from '@/lib/redis/client';

/**
 * POST /api/user/avatar
 * Upload user avatar
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cerere invalidă' }, { status: 403 });
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Fișier lipsă' },
        { status: 400 }
      );
    }

    // Get current avatar URL before uploading new one
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    // Delete old avatar if exists (prevents having multiple avatar files with different extensions)
    if (currentUser?.avatarUrl) {
      await deleteAvatar(currentUser.avatarUrl);
    }

    // Upload new avatar to Supabase Storage
    const avatarUrl = await uploadAvatar(file, user.id);

    // Update user avatar in database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });

    // Invalidate feed cache so posts show new avatar
    await invalidateFeedCache();

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    const message = error instanceof Error ? error.message : 'Eroare la încărcarea avatarului';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/user/avatar
 * Delete user avatar
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cerere invalidă' }, { status: 403 });
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    // Get current avatar URL
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    // Delete from storage if exists
    if (currentUser?.avatarUrl) {
      await deleteAvatar(currentUser.avatarUrl);
    }

    // Remove avatarUrl from database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });

    // Invalidate feed cache so posts show default avatar
    await invalidateFeedCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Avatar delete error:', error);
    const message = error instanceof Error ? error.message : 'Eroare la ștergerea avatarului';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
