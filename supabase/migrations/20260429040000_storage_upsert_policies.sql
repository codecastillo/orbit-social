-- Cover/avatar storage upserts were silently failing because the original
-- bucket policies only granted INSERT — `upsert: true` on an existing object
-- needs UPDATE (and DELETE in some Supabase versions). This adds the missing
-- ones for both buckets so users can replace their photo/banner repeatedly.

-- Covers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own cover" ON storage.objects;
CREATE POLICY "Users can update their own cover"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own cover" ON storage.objects;
CREATE POLICY "Users can delete their own cover"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Avatars ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
