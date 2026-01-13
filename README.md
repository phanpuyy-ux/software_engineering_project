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

## Quick Start (Local)
1. `git clone <repo-url>`
2. `cd software_engineering_project`
3. `npm install`
4. `npx vercel dev`
5. Open `http://localhost:3000/login`

If you only need the UI, open `public/login.html` directly in a browser, but serverless APIs will not be available.

## Update From Remote
- `git pull`
- `npm install` (if dependencies changed)

## Deployment (Vercel)
1. `npm install`
2. `npx vercel login`
3. `npx vercel link` (or create a new project)
4. Set required environment variables (see Configuration).
5. `npx vercel deploy --prod`

The `vercel.json` file enables clean URLs like `/login` and `/register`.

## Usage
1. Visit `/register` to create an account.
2. Follow the email verification prompt (demo link shown in UI).
3. Sign in at `/login`.
4. Start a chat on `dashboard.html` and use the mic for voice input if supported.
5. Daily limits apply (guest 20/day, signed-in 100/day).

## Configuration
Server-side environment variables (Vercel):
- `OPENAI_API_KEY` (required for /api/chat)
- `OPENAI_ORG_ID` (optional)
- `OPENAI_PROJECT_ID` (optional)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required by `server/chat/OpenAIChatEngine.js`)
- `FIREBASE_SERVICE_ACCOUNT` (Firestore storage for /api/storage)
- `RESEND_API_KEY` and `EMAIL_FROM` (email sending for /api/email)
- `USE_MOCK_CHAT=true` to use the mock chat engine

For `vercel dev`, set env vars in `.env.local` or use `npx vercel env pull`.

Client-side:
- Firebase API key in `public/js/firebase-auth.js`
- Optional TTS override via `window.TTS_CONFIG`

## Notes
- Local Whisper ASR loads a ~75MB model on first use.
- Data is stored in localStorage and synced via `/api/storage` when available.
