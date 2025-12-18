-- Add last_active column to profiles for tracking online status
ALTER TABLE public.profiles ADD COLUMN last_active timestamp with time zone DEFAULT now();

-- Create index for efficient querying
CREATE INDEX idx_profiles_last_active ON public.profiles(last_active DESC);