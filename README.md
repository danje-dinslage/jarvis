# Jarvis v1.14.4

Browser-based Jarvis prototype with file-based continuity.

## v1.2 changes

- Added custom export file naming.
- Exported files now use `<name>_PROJECT_STATE.md` and `<name>_JARVIS_STATE.json`.

## v1.1 changes

- Added `PROJECT_STATE.md` export.
- Added `JARVIS_STATE.json` export.
- Added `JARVIS_STATE.json` import.
- This provides Phase 1 persistence without authentication or a database.
- Unified right-panel Status card retained.
- Qualitative field states retained.
- Conservative progress retained.
- Trust calibration / evidence precedence retained.

## What this means

This is not automatic cloud persistence. It is portable project-state persistence:

1. Work with Jarvis.
2. Export `JARVIS_STATE.json`.
3. Later, upload/import that file.
4. Jarvis resumes from the saved state.

`PROJECT_STATE.md` is the human-readable handover version.

## Deploy

Upload the contents of this folder to GitHub and deploy with Vercel.

Required environment variable:
- `ANTHROPIC_API_KEY`

Optional:
- `ANTHROPIC_MODEL`
- `BETA_PASSWORD`

No root-level `jarvis.ts`, `page.tsx`, or `route.ts` files should exist.
