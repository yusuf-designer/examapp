# ExamEval (MBBS answer-copy grading demo)

Owner is a designer, not an engineer. Explain in simple Hinglish when they write Hinglish, show commands to copy and paste, and keep answers short.

## What it does
Admin uploads one student's scanned answer copy -> AI reads it (Mistral OCR) and proposes marks against a locked marking scheme -> evaluators check and finalise -> Admin signs off and publishes -> the student sees marks, annotated crop and reasons.
Roles in use: Admin (id `coe`), Evaluator, Student. Dean, Principal, HOD and Auditor are suspended in `src/lib/permissions.ts` (`ACTIVE_ROLES`).

## Run and test
- `npm install`, then `npm start` (builds, then serves http://localhost:5174). Keys live in `settings.txt` (never commit it).
- `npm test` (about 55 tests), `npm run typecheck`.
- Keys: `MISTRAL_API_KEY`, `MISTRAL_MODEL` (default mistral-small-latest), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, optional `APP_PASSWORD` (browser password prompt for the whole app).

## Layout
- `server/index.ts`: HTTP handler (`handler`), routes `/api/health`, `/api/state`, `/api/doc`, `/api/scan`, `/api/scan/stream` (NDJSON progress).
- `server/ai.ts`: pipeline. Lines are sorted into questions by their headings (no AI call unless a question has no heading), then every question is graded in parallel. A question that fails is left for the evaluator.
- `server/mistral.ts`: Mistral chat and OCR, with retries and timeouts. `server/store.ts`: Supabase or file storage.
- `src/lib/rubric.ts`: the marks engine (AI reports evidence; fixed rules compute marks, caps and diagram/terms).
- `src/lib/seed.ts` and `src/lib/paper2.ts`: the demo marking scheme (Q2 Atherosclerosis, Q2(e), Q3(a), Q3(c), Q4 MCQ). `CLEAN_VERSION` in seed.ts: raise it to wipe shared data back to the clean start.
- `src/components/LiveScan.tsx`: live grading view shown during upload.

## Hosting
- Render (free): `render.yaml`. Start command `npx tsx server/index.ts`.
- Vercel: `vercel.json` plus the prebuilt function `api/index.mjs`. After ANY change under `server/` or `src/lib/*` that the server imports, run `npm run build:api` and commit the new `api/index.mjs`. Vercel needs Supabase (no disk), and requests are limited to about 4.5 MB (the app shrinks photos to fit when `/api/health` reports `maxBodyBytes`).

## Rules
- Never put API keys in code, chat or git. `settings.txt` and `data/` are git-ignored.
- Keep marks logic deterministic; the AI never decides final marks.
