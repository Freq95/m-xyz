import { createClient } from './server';
import { IMAGE_VALIDATION } from '@/lib/validations/post';

const BUCKET_NAME = 'post-images';

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
 * Get image dimensions from a File object
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
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

  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
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

    // Get image dimensions (server-side using canvas or similar would be better, but for now return null)
    // In a real app, you'd use sharp or similar library on the server
    const dimensions = null; // await getImageDimensions(file); // Can't run in Node.js without canvas

    // Generate thumbnail URL using Supabase's image transformation
    // Format: {publicUrl}?width=400&height=300
    const thumbnailUrl = `${publicUrl}?width=400&height=300`;

    return {
      url: publicUrl,
      thumbnailUrl,
      width: dimensions?.width || null,
      height: dimensions?.height || null,
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
