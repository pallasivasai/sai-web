# S-Secret Chat

**S-Secret Chat** is a real-time private messaging web application built around Supabase authentication, PostgreSQL realtime changes, presence, storage, and browser media APIs.

**Live app:** https://sai-web.lovable.app

The application supports authenticated one-to-one conversations with text, images, voice messages, online status, typing indicators, read receipts, and an optional per-user chat password.

## Main features

### Authentication

The authentication page supports four flows:

- Sign in with email and password
- Create an account with username, email, and password
- Forgot-password email flow
- Password reset

Supabase Auth manages the session. Unauthenticated users are redirected to `/auth`.

### Private one-to-one chat

After login, the user selects another profile and opens a conversation.

Messages are loaded for the selected sender/recipient pair and ordered by creation time.

### Real-time updates

The chat listens to Supabase Realtime `postgres_changes` events on the `messages` table.

New messages and message updates can therefore appear without a manual page refresh.

### Online presence

The app uses a Supabase presence channel named `online-users`.

The current profile publishes its profile ID as presence data and refreshes `last_active` every 30 seconds.

### Typing indicator

A broadcast channel is created for the selected pair of users.

Typing events are sent through this channel, and the recipient sees a temporary typing state.

### Read receipts

Incoming messages can receive a `read_at` timestamp.

Opening a conversation marks unread messages from the selected recipient as read.

### Image messages

Images are uploaded to the Supabase Storage bucket `chat-media`.

The generated public URL is stored in the `messages` row and rendered in the conversation.

### Voice messages

The browser `MediaRecorder` API captures microphone audio.

The recorded WebM file is uploaded to `chat-media`, stored as a message URL, and can be played back in the conversation.

### Chat password

A user can set, change, or remove an optional chat password.

When a protected contact is selected, the app requests that password before opening the conversation.

## User flow

```text
Supabase Auth
   |
   v
Authenticated Chat Room
   |
   v
Select another profile
   |
   +--> optional chat-password check
   |
   v
1-to-1 conversation
   |
   +--> text
   +--> image
   +--> voice
   |
   v
Supabase
   +--> profiles
   +--> messages
   +--> Realtime
   +--> Storage
```

## Message lifecycle

### Text

The UI inserts a message containing:

- `content`
- `sender_name`
- `sender_id`
- `recipient_id`

### Image

1. Validate the selected file is an image.
2. Upload it to `chat-media`.
3. Obtain its public URL.
4. Insert a message containing `image_url`.

### Voice

1. Request microphone access.
2. Record with `MediaRecorder`.
3. Create a WebM blob.
4. Upload it to `chat-media`.
5. Insert a message containing `voice_url`.

## Important implementation files

| File | Responsibility |
|---|---|
| `src/pages/Auth.tsx` | Login, signup, forgot password and reset password |
| `src/pages/Index.tsx` | Session gate and authenticated entry point |
| `src/components/ChatRoom.tsx` | Messaging, realtime events, presence, typing, media and chat-password logic |
| `src/integrations/supabase/client.ts` | Supabase client |
| `src/components/ui/` | Reusable interface components |

## Technology stack

- React
- TypeScript
- Vite
- Supabase Auth
- Supabase PostgreSQL
- Supabase Realtime
- Supabase Storage
- Tailwind CSS
- shadcn/Radix UI
- Browser `MediaRecorder` API

## Run locally

```bash
git clone https://github.com/pallasivasai/sai-web.git
cd sai-web
npm install
npm run dev
```

The repository client integration must be configured for the Supabase project used by the application.

## Current implementation notes

- Conversation selection is tied to authenticated profile IDs.
- Realtime inserts/updates are filtered for the current conversation.
- `read_at` is used for read receipts.
- `last_active` is periodically refreshed.
- Media is stored in the `chat-media` bucket.
- The chat password feature is an application-level access check; treat the current project as a demo/learning implementation rather than a security product.

## Links

- [Live App](https://sai-web.lovable.app)
- [GitHub Repository](https://github.com/pallasivasai/sai-web)
