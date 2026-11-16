# Running ExamEval on your own, without Claude

This version has its own server. The server holds your keys, reads the pages with Mistral, grades them, and keeps the data in Supabase. Everyone opens the app from one web address.

## What you need
- A computer with **Node.js 20 or newer** (nodejs.org).
- A **Mistral API key** (console.mistral.ai, API keys).
- A **Supabase** project (supabase.com, free plan is enough to start).

## Step 1. Make the table in Supabase (once)
1. Open your Supabase project, then **SQL Editor**, then **New query**.
2. Open the file `supabase/schema.sql` from this folder, copy everything, paste it, press **Run**.
3. Go to **Project Settings > API Keys**. Under **Secret keys**, copy the `default` key (it starts with `sb_secret_`). The older `service_role` key under "Legacy API keys" also works.
   The secret key is a secret. Only the server uses it. It must never go in the web page.

## Step 2. Fill in the settings
1. In this folder, open the file **`settings.txt`** in any text editor (Notepad, TextEdit).
2. After `MISTRAL_API_KEY=` paste your Mistral key. After `SUPABASE_SERVICE_KEY=` paste the service_role key. The Supabase URL line is already filled for the Grading project; change it if you use another.
3. Save the file. (Files that start with a dot, like `.env`, are hidden on Mac, so `settings.txt` is used instead. A `.env` file also works if you prefer.)

## Step 3. Start it
```
npm install
npm start
```
The terminal prints the address (http://localhost:5174) and says which AI and which database it found. It should say `AI: mistral` and `Data: Supabase`. If it says "keyword stand-in" or "a file on this computer", a key is missing in `.env`.

## Step 4. Put it online so others can open it
Any host that runs Node works (Render, Railway, a college server). On Render, for example:
- New > Web Service, connect this folder from GitHub.
- Build command: `npm install && npm run build`
- Start command: `npx tsx server/index.ts`
- Environment: add the same variables as in `.env`.

## How it works once running
1. The Admin uploads page photos for one student. The server sends each photo to Mistral OCR, then asks the grading model to sort the lines into questions and mark them against the locked scheme.
2. The Admin assigns copies to evaluators, who check the marks and finalise.
3. The Admin signs off and publishes. The student signs in and sees their marked pages.

## Things to know before real use
- **There is no real sign-in yet.** Anyone who can open the address can choose any role. Do not put it on the open internet with real student data. The next step is real accounts (Supabase Auth or college Google sign-in).
- **Student sheets go to Mistral's servers.** Check that the college allows this.
- **The first real run needs checking.** This was tested against pretend Mistral and Supabase servers, not the real ones. If the page positions look wrong or a call fails, the message in the terminal says which. Send it to whoever maintains this.
- **Cost.** Mistral charges per page read and per grading call. Try 10 copies first and look at the bill.
- **Marks are proposals.** Evaluators decide. Test the grading against copies you have marked by hand before trusting it.
