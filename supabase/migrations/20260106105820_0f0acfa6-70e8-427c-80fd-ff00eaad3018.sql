-- Create trigger to create profile when new user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profiles for existing users who don't have one
INSERT INTO public.profiles (user_id, username)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;