# Supabase Storage Setup

## Avatar Bucket Configuration

To enable avatar uploads, you need to create an `avatars` bucket in Supabase Storage.

### Steps:

1. **Navigate to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/storage/buckets

2. **Create New Bucket**
   - Click "New bucket"
   - Bucket name: `avatars`
   - Public bucket: ✓ **YES** (checked)
   - Click "Create bucket"

3. **Set Bucket Policies** (Optional - for security)

   Navigate to Storage > Policies and add the following policies for the `avatars` bucket:

   **Policy 1: Allow authenticated users to upload their own avatar**
   ```sql
   CREATE POLICY "Users can upload their own avatar"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'avatars'
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

   **Policy 2: Allow authenticated users to update their own avatar**
   ```sql
   CREATE POLICY "Users can update their own avatar"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'avatars'
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

   **Policy 3: Allow authenticated users to delete their own avatar**
   ```sql
   CREATE POLICY "Users can delete their own avatar"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'avatars'
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

   **Policy 4: Allow public read access to all avatars**
   ```sql
   CREATE POLICY "Anyone can view avatars"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'avatars');
   ```

4. **File Size Limit** (Optional)
   - The application validates max 5MB per image
   - You can also set a global limit in Supabase Storage settings

5. **Allowed File Types**
   - The application accepts: JPG, PNG, WebP, GIF
   - MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

### Testing

After setup, test avatar upload by:
1. Navigate to `/settings`
2. Click "Încarcă" button under "Poză de profil"
3. Select an image (max 5MB)
4. Avatar should upload and display immediately

### Troubleshooting

If uploads fail:
- Check bucket name is exactly `avatars` (case-sensitive)
- Verify bucket is set to **public**
- Check browser console for errors
- Verify Supabase URL and keys in `.env`
