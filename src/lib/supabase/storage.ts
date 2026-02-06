import { createClient } from './server';
import { IMAGE_VALIDATION } from '@/lib/validations/post';

const BUCKET_NAME = 'post-images';
const AVATARS_BUCKET = 'avatars';

interface UploadResult {
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
}

interface UploadError {
  error: string;
  code?: string;
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): UploadError | null {
  // Check file size
  if (file.size > IMAGE_VALIDATION.MAX_SIZE) {
    return {
      error: `Imaginea este prea mare. Mărimea maximă este ${IMAGE_VALIDATION.MAX_SIZE / (1024 * 1024)}MB`,
      code: 'FILE_TOO_LARGE',
    };
  }

  // Check file type
  if (!IMAGE_VALIDATION.ALLOWED_TYPES.includes(file.type as any)) {
    return {
      error: 'Format invalid. Folosește JPG, PNG sau WebP',
      code: 'INVALID_FILE_TYPE',
    };
  }

  return null;
}

/**
 * Upload a post image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The ID of the user uploading the image
 * @returns Upload result with URLs and metadata
 */
export async function uploadPostImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  // Validate file
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError.error);
  }

  // Generate unique filename with validated extension
  // Extract extension from MIME type instead of filename to prevent path traversal
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const fileExt = mimeToExt[file.type] || 'jpg';
  const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

  try {
    // Get Supabase client
    const supabase = await createClient();

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Eroare la încărcarea imaginii: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

    // Generate thumbnail URL using Supabase's image transformation
    // Format: {publicUrl}?width=400&height=300
    const thumbnailUrl = `${publicUrl}?width=400&height=300`;

    return {
      url: publicUrl,
      thumbnailUrl,
      width: null,
      height: null,
      sizeBytes: file.size,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error instanceof Error
      ? error
      : new Error('Eroare necunoscută la încărcarea imaginii');
  }
}

/**
 * Delete an image from Supabase Storage
 * @param url - The public URL of the image to delete
 */
export async function deletePostImage(url: string): Promise<void> {
  try {
    const supabase = await createClient();

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const urlParts = url.split(`/${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
      throw new Error('Invalid image URL');
    }

    const filePath = urlParts[1].split('?')[0]; // Remove query params

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new Error(`Eroare la ștergerea imaginii: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    // Don't throw - allow post deletion to succeed even if image deletion fails
  }
}

/**
 * Delete multiple images from Supabase Storage
 * @param urls - Array of public URLs to delete
 */
export async function deletePostImages(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => deletePostImage(url)));
}

/**
 * Upload an avatar image to Supabase Storage
 * @param file - The avatar image file to upload
 * @param userId - The ID of the user uploading the avatar
 * @returns Public URL of the uploaded avatar
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<string> {
  // Validate file
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError.error);
  }

  // Generate filename in user's folder (required for RLS policy)
  // Extract extension from MIME type instead of filename to prevent path traversal
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const fileExt = mimeToExt[file.type] || 'jpg';
  const fileName = `${userId}/avatar.${fileExt}`;

  try {
    const supabase = await createClient();

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage (upsert: true to replace existing avatar)
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true, // Replace existing avatar
      });

    if (error) {
      console.error('Supabase avatar upload error:', error);
      throw new Error(`Eroare la încărcarea avatarului: ${error.message}`);
    }

    // Get public URL with cache-busting timestamp
    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(data.path);

    // Add cache-busting parameter to force browser to fetch new image
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

    return cacheBustedUrl;
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw error instanceof Error
      ? error
      : new Error('Eroare necunoscută la încărcarea avatarului');
  }
}

/**
 * Delete an avatar from Supabase Storage
 * @param url - The public URL of the avatar to delete
 */
export async function deleteAvatar(url: string): Promise<void> {
  try {
    const supabase = await createClient();

    // Extract file path from URL
    const urlParts = url.split(`/${AVATARS_BUCKET}/`);
    if (urlParts.length < 2) {
      throw new Error('Invalid avatar URL');
    }

    const filePath = urlParts[1].split('?')[0]; // Remove query params

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Supabase avatar delete error:', error);
      throw new Error(`Eroare la ștergerea avatarului: ${error.message}`);
    }
  } catch (error) {
    console.error('Avatar delete error:', error);
    // Don't throw - allow operation to succeed even if deletion fails
  }
}
