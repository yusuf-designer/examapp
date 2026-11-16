# ExamEval AI · MBBS answer-script grading (prototype)

**To run this on your own server with Mistral and Supabase (no Claude), read `SETUP.md`.**

React + TypeScript + Vite + Tailwind + shadcn/ui components.

    npm install
    npm run dev        # http://localhost:5173
    npm test           # rubric engine, permissions, workflow and UI smoke tests
    npm run build      # single-file build in dist/index.html

## What is real and what is simulated
Real: rubric scoring engine (content, diagram, terminology, deal-breaker caps), role permissions,
time windows, scheme locking and versioning, edit requests with impact preview, examiner overrides
with required reasons, sign-off and publication, student annotations and rechecks (blind second
evaluator), SHA-256 hash-chained audit trail with verification.

Simulated: scanning, handwriting recognition and the AI findings. "Demo batches" generate scripts
with synthetic findings. State is stored in the browser (localStorage). There is no server,
login or database. Replace `src/lib/store.ts` with API calls and enforce `src/lib/permissions.ts`
on the server before using real marks.

## Switching roles
Use "Viewing as" in the top bar. Suggested walkthrough:
1. Controller (Dr. T. Ansari): Scripts -> assign by question.
2. Evaluator (Dr. A. Rahman / Dr. S. Khan): My marking -> review flagged answers, accept the rest.
3. Dean: Results and rechecks -> Sign off. Controller: Publish.
4. Student (Zainab Ali): annotate script, request recheck.
5. Controller assigns the recheck to the second evaluator, who decides it.
6. Dean/Auditor: Audit trail -> Verify chain.
Pharmacology Paper II demonstrates the evaluator entry window and locking (Dr. M. Iqbal).

## shadcn/ui components used
Written to match shadcn's source (the registry was not reachable when this was built), in `src/components/ui/`:
accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, dialog, empty, field,
input, item, label, native-select, progress, radio-group, select, separator, sheet, slider, switch,
table, tabs, textarea, toast (+ toaster), toggle-group, tooltip.
To use the official versions run `npx shadcn@latest init`, then `npx shadcn@latest add <name>` and
let it overwrite the files; imports are the same (`@/components/ui/...`).
Not used: sidebar (custom nav), data-table, chart, calendar and the chat-style components.


## Running with real scanning and AI marking

1. `npm install`
2. Copy `.env.example` to `.env` and put your Anthropic API key after `ANTHROPIC_API_KEY=`.
3. `npm start` (builds the app and starts the server), then open http://localhost:5174

Without a key the app still runs. Handwriting cannot be read, but you can paste typed answer text on the Scripts page to try the whole flow.

How a scan is handled:
1. The Controller uploads the pages of one answer book (photos or PDF).
2. The server asks the AI to rewrite each page as text, keeping the student's own words, and to tag which question each part answers.
3. For each question the AI reports evidence against the locked rubric: marks per point with a quote and a reason for any lost marks, the diagram elements found, key terms used, and any critical error. The rules engine, not the AI, adds up the total and applies the caps.
4. Evaluators see the original scan beside the rewritten text and the list of where marks were lost, and can override with a written reason.
5. Students see the same list and can dispute a point with their own written answer. A second evaluator, who cannot see the first marks, decides.

Data is still stored in the browser (localStorage). A shared database is the next step.
