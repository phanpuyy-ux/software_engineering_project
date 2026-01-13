# BIOE70071 Policy Assistant Prototype

A multi-part prototype for a bioengineering policy assistant: a static web UI,
Vercel serverless APIs for chat/email/storage, a FastAPI vector search service,
and a Node CLI agent demo.

## What is in this repo
- Web frontend: static HTML/CSS/JS pages for auth and chat.
- Serverless API (Vercel): `/api/chat`, `/api/email`, `/api/storage`, `/api/read`.
- FastAPI service: FAISS-backed policy search over
  `FastAPI/data/imperial_policies.jsonl`.
- Agent demo: Node CLI that uses OpenAI Agents with File Search.
- Shared server code: API handlers and chat engines under `server/`.

## Architecture
```text
Browser (public/*.html)
  |-- fetch /api/chat ----> server/handlers/ChatApiHandler
  |                         -> OpenAIChatEngine (OpenAI Agents + File Search)
  |                         -> MockChatEngine (optional)
  |-- fetch /api/storage -> server/handlers/StorageApiHandler -> Firestore (kv)
  |-- fetch /api/email --> Resend (simulated if no API key)
  |-- fetch /api/read ---> fetch(url) -> raw HTML

FastAPI service (FastAPI/main.py)
  |-- /search -> FAISS + sentence-transformers -> imperial_policies.jsonl

CLI demo (agent_demo/agent.js)
  |-- OpenAI Agents + File Search
```

## Features
- Auth pages for login/register/forgot/reset/confirm flows.
- Chat UI with history, daily usage limits, and local persistence.
- Voice input: mic recording, local Whisper ASR, optional TTS playback.
- Optional Firestore sync and Resend transactional email.
- OpenAI Agents integration with structured JSON output.
- Standalone vector search service for policy snippets.

## Tech stack
- Frontend: HTML/CSS/JS (no build step).
- Serverless: Vercel functions (Node, ESM).
- LLM: `@openai/agents`, `openai`, File Search tool.
- Auth: Firebase Identity Toolkit REST (client side).
- Storage: Firebase Admin Firestore (serverless), localStorage (client).
- Email: Resend.
- Vector search: FastAPI, sentence-transformers, FAISS.

## Project layout
```text
.
|-- api/
|   |-- chat.js
|   |-- email.js
|   |-- read.js
|   |-- storage.js
|   `-- lib/
|       `-- supabaseServer.js
|-- server/
|   |-- chat/
|   |-- core/
|   `-- handlers/
|-- public/
|   |-- *.html
|   |-- css/
|   `-- js/
|-- FastAPI/
|   |-- main.py
|   |-- requirements.txt
|   `-- validation_service/
|-- agent_demo/
|-- vercel.json
|-- package.json
|-- readmore.md
```

## Prerequisites
- Node.js 18+ (Vercel dev and serverless functions).
- Python 3.10+ (FastAPI uses PEP 604 union types).
- Vercel CLI (optional, `npx vercel dev` works without global install).

## Running locally

### Option A: Vercel dev (frontend + /api)
1. Install Node dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (see Configuration).
3. Start the dev server:
   ```bash
   npx vercel dev
   ```
4. Open `http://localhost:3000/login` or `/register`.

### Option B: static UI only
Serve the `public/` folder with any static server, or open the HTML files
directly. API calls to `/api/*` will not work in this mode.

Example:
```bash
npx serve public
```

### FastAPI policy search
```bash
cd FastAPI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Endpoints:
- `GET /health`
- `GET /search?q=your+query&k=5`

### Agent demo CLI
```bash
node agent_demo/agent.js
```
Requires OpenAI credentials in the environment.

## Configuration

### Vercel serverless (`/api/*`)
Required:
- `OPENAI_API_KEY` (for `/api/chat`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required by
  `api/lib/supabaseServer.js` import)

Optional:
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`
- `USE_MOCK_CHAT=true` (force `MockChatEngine`)
- `FIREBASE_SERVICE_ACCOUNT` (enables Firestore sync in `/api/storage`)
- `RESEND_API_KEY` (enables real email send in `/api/email`)
- `EMAIL_FROM` (default `noreply@example.com`)

### FastAPI service
- `DATA_PATH` (default `data/imperial_policies.jsonl`)
- `TEXT_KEY` (default `text`)
- `MODEL_NAME` (default `sentence-transformers/all-MiniLM-L6-v2`)
- `K` (default `5`)

### Frontend
- `public/js/firebase-auth.js` contains the Firebase API key.
- `public/js/app.js` reads `window.TTS_CONFIG` (optional) to override TTS
  settings for the iFlytek WebSocket API.

## API reference

### `POST /api/chat`
Body:
```json
{
  "userText": "string",
  "history": [{ "role": "user|assistant", "content": "..." }],
  "userEmail": "optional"
}
```
Response:
```json
{
  "reply": "string",
  "structured": {
    "grade": "...",
    "major": "...",
    "conclusion": "...",
    "analysis": "...",
    "related_policies": []
  },
  "sources": []
}
```

### `GET /api/storage?key=ft_users|ft_chats|ft_messages`
Returns:
```json
{ "key": "...", "value": null }
```

### `POST /api/storage`
Body:
```json
{ "key": "ft_users|ft_chats|ft_messages", "value": {} }
```
Returns:
```json
{ "ok": true }
```

### `POST /api/email`
Body:
```json
{ "to": "...", "subject": "...", "html": "..." }
```
Returns `{ "ok": true, "simulated": true }` if `RESEND_API_KEY` is missing.

### `POST /api/read`
Body:
```json
{ "url": "https://example.com" }
```
Returns:
```json
{ "content": "<html>...</html>" }
```

## Frontend pages and routes
- `public/login.html`: login via Firebase REST.
- `public/register.html`: sign up via Firebase REST.
- `public/forgot.html`: password reset email via Firebase REST.
- `public/dashboard.html`: main chat UI (auth gated).
- `public/index.html`: alternate login UI (legacy).
- `public/reset.html` and `public/confirm.html`: demo flows implemented in
  `public/js/app.js`.

`vercel.json` rewrites:
- `/login` -> `login.html`
- `/register` -> `register.html`
- `/forgot` -> `forgot.html`
- `/reset` -> `reset.html`
- `/confirm` -> `confirm.html`

Note: `public/js/app.js` includes local demo auth, confirm, and reset handlers,
but those initializers are currently commented out. To use the local demo flow,
uncomment the `initRegisterPage`, `initLoginPage`, `initForgotPage`,
`initResetPage`, and `initConfirmPage` calls in `public/js/app.js`.

## Data model (frontend)
Local storage keys:
- `ft_users`: array of `{ email, passwordHash, isVerified, verifyToken, resetToken }`
- `ft_chats`: array of `{ id, title, createdAt, userEmail }`
- `ft_messages`: map `{ [chatId]: [{ id, role, text, createdAt, pending?, audioDataUrl?, asrMethod? }] }`

Remote storage:
- Firestore collection `kv` with docs `ft_users`, `ft_chats`, `ft_messages`,
  each storing `{ value: <json> }`.

## Voice features
- Mic recording via `MediaRecorder`.
- Local ASR: Whisper Tiny in-browser via `@xenova/transformers` (downloads the
  model on first run).
- TTS: iFlytek WebSocket API when `TTS_CONFIG` is provided, with fallback to
  browser `speechSynthesis`.

## Security and demo caveats
- Local auth in `public/js/app.js` is for demo only and not secure.
- Client-side Firebase API keys are expected for Firebase REST auth but do not
  replace server-side security rules.
- Keep OpenAI, Supabase, Firebase service account JSON, and Resend credentials
  out of the repo.

## Troubleshooting
- `/api/chat` errors: verify `OPENAI_API_KEY` and required Supabase vars.
- Storage sync fails: verify `FIREBASE_SERVICE_ACCOUNT` is valid JSON and
  Firestore is enabled.
- Voice input issues: check microphone permission and first-run model download.

## More details
See `readmore.md` for modification history and notes.
