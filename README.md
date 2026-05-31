# Jarvis v0.6

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

## v0.6.1 Personality Update

This version changes Jarvis from a rigid governance-report style to a more natural chief-of-staff voice.

The constitution still governs the reasoning, but Jarvis should no longer force every response into `Assessment / Risk / Recommendation / Confidence`.

Expected behavior:

- more conversational
- less bureaucratic
- stronger pushback when useful
- fewer visible governance labels
- still state-aware, scope-aware, and risk-aware

## v0.6.0 — Auto State Update

- Jarvis now updates Mission, Status, Confidence, Approval, Next Action, Risks, and Decisions from conversation turns.
- Side panels are read-only by default.
- Manual correction is available through Edit mode.
- New Session clears chat history but keeps project state.


## v0.6

Adds an in-chat Jarvis activity panel while Claude is thinking. The panel shows mission, scope, assumptions, risk, and recommendation checks instead of a generic loading spinner.
