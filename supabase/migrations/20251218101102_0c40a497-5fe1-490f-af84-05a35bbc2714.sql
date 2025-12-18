-- Add read_at column for read receipts
ALTER TABLE public.messages ADD COLUMN read_at timestamp with time zone DEFAULT NULL;

-- Allow users to update read_at on messages they received
CREATE POLICY "Users can mark messages as read"
ON public.messages
FOR UPDATE
USING (auth.uid() IN (SELECT profiles.user_id FROM profiles WHERE profiles.id = messages.recipient_id))
WITH CHECK (auth.uid() IN (SELECT profiles.user_id FROM profiles WHERE profiles.id = messages.recipient_id));