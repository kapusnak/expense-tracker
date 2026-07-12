# Klid — Calm Spend

Zero-UI expense tracker. One microphone button, one text field, one calm status sentence.

## Stack

- Next.js 16.2 (App Router, Turbopack)
- Tailwind CSS v4
- OpenAI API (`gpt-5.6-luna` for extraction, `gpt-4o-mini-transcribe` for voice)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and add your OpenAI key:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

Optional model overrides:

```env
OPENAI_EXTRACTION_MODEL=gpt-5.6-luna
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

3. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Voice:** Press and hold the microphone button, say what you bought, release.
- **Text:** Type a natural sentence like `Koupil jsem kafe za 90 a boty na crossfit za 2500` and submit.

The app extracts amount, items, and one of four mindful categories:

- Nezbytné závazky
- Radost & Život
- Investice do sebe
- Rodina & Vztahy

## API Routes

- `POST /api/process` — `{ "text": "..." }` → structured expense JSON
- `POST /api/transcribe` — `FormData` with `audio` file → `{ "text": "..." }`

## Notes

- Data is stored in React state only (no database in this MVP).
- Requires microphone permission for voice input.
- Without `OPENAI_API_KEY`, API routes return a clear 503 error.

## Next steps

- Supabase persistence + auth
- Stripe subscription ($10/month, 7-day trial)
- Weekly calm summary message
