# Deploy Jarvis v0.2 to Vercel

## Fast path

1. Create a GitHub repo.
2. Upload the contents of this folder.
3. Open https://vercel.com/new.
4. Import the repo.
5. Add environment variables:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
JARVIS_BETA_PASSWORD=choose-a-password
```

6. Click Deploy.

## After deploy

Open the generated Vercel URL.

Enter the beta password in the Jarvis input area.

Start with:

```text
What should we do next?
```

Then test:

```text
Should we add team features now?
```

A good Jarvis response should not act like a generic chatbot. It should reference mission, risk, scope, recommendation, and confidence.
