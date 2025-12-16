-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'username', 'User'));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Modify messages table to support private messaging
ALTER TABLE public.messages 
ADD COLUMN sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;

-- New policies for private messaging
CREATE POLICY "Users can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = sender_id)
);

CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE id = sender_id OR id = recipient_id
  )
);