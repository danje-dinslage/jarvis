# Jarvis Web v1.0

Clean browser-based Jarvis prototype.

## v1.0 changes

- Unified right-panel Status card
- Qualitative field states: Unknown / Initial / Partial / Defined / Validated
- Removed arbitrary per-field percentages
- Scope state stays Unknown/Monitoring until enough context exists
- Intent-aware in-chat Status panel
- Conservative progress bar remains as the only numeric progress indicator
- Trust calibration / evidence precedence prompt retained

## Deploy

Upload the contents of this folder to GitHub and deploy with Vercel.

Required environment variable:
- `ANTHROPIC_API_KEY`

Optional:
- `ANTHROPIC_MODEL`
- `BETA_PASSWORD`

No root-level `jarvis.ts`, `page.tsx`, or `route.ts` files should exist.
