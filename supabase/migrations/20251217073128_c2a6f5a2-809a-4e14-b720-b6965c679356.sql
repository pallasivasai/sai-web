-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

-- Allow anyone to view files (since bucket is public)
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add media columns to messages table
ALTER TABLE public.messages
ADD COLUMN image_url TEXT,
ADD COLUMN voice_url TEXT;