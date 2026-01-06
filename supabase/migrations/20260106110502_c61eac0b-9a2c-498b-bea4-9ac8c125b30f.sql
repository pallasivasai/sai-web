-- Add chat_password column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN chat_password text DEFAULT NULL;

-- Update RLS to allow users to see if someone has a password set (but not the actual password)
-- The actual password verification will happen client-side for simplicity