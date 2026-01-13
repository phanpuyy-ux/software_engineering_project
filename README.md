# BIOE70071 Software Engineering Project

Voice-enabled web assistant for Bioengineering Department policy questions. The frontend is served from `public/` with Firebase auth pages and a chat dashboard. Serverless APIs under `api/` provide chat, storage, and email helpers.

## Features
- Email/password auth with Firebase Identity Toolkit
- Email verification and password reset flows
- Chat dashboard with history and daily usage limits
- Voice input via Web Speech API and local Whisper (transformers.js)
- Optional TTS playback
- Serverless APIs for chat, storage (Firestore), and email (Resend)

## Pages
- `/login`, `/register`, `/forgot`, `/reset`, `/confirm`
- `dashboard.html` (chat UI)

## Project Structure
- `public/` - static pages, styles, and client JS
- `api/` - Vercel serverless functions
- `server/` - API handlers and chat engines

## Local Development
1. `npm install`
2. `npx vercel dev`
3. Open `http://localhost:3000/login`

If you only need the UI, open `public/login.html` directly in a browser, but serverless APIs will not be available.

## Configuration
Server-side environment variables (Vercel):
- `OPENAI_API_KEY` (required for /api/chat)
- `OPENAI_ORG_ID` (optional)
- `OPENAI_PROJECT_ID` (optional)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required by `server/chat/OpenAIChatEngine.js`)
- `FIREBASE_SERVICE_ACCOUNT` (Firestore storage for /api/storage)
- `RESEND_API_KEY` and `EMAIL_FROM` (email sending for /api/email)
- `USE_MOCK_CHAT=true` to use the mock chat engine

Client-side:
- Firebase API key in `public/js/firebase-auth.js`
- Optional TTS override via `window.TTS_CONFIG`

## Notes
- Local Whisper ASR loads a ~75MB model on first use.
- Data is stored in localStorage and synced via `/api/storage` when available.
