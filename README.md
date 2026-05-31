# Jarvis v0.2

A hosted-web prototype for a constitution-governed AI project navigator.

The goal is simple: open a browser URL and chat with Jarvis, not run a terminal app.

## What this is

Jarvis is a project navigator that answers through:

- mission state
- risks
- decisions
- approval state
- scope awareness
- confidence level

The user chats with Jarvis. Claude is the model behind it. The constitution is the filter that shapes Jarvis' behavior.

## Deploy to Vercel

1. Create a new GitHub repository and upload these files.
2. Go to Vercel and import the repository.
3. Add these environment variables in Vercel:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
JARVIS_BETA_PASSWORD=your-beta-password
```

`JARVIS_BETA_PASSWORD` is optional but recommended so strangers cannot use your API key.

4. Deploy.
5. Open the Vercel URL.

## Local fallback

If you need to test locally:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Important

This is not production-ready.

It intentionally has:

- no accounts
- no database
- no billing
- no teams
- no persistence beyond browser localStorage

It only tests one thing:

Does talking to Jarvis feel materially different from talking to raw Claude?
