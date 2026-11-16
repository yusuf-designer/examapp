import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { anthropicCall, evaluateScript, mockCall, type ModelCall, type Page, type QuestionInput, type ScanEvent } from "./ai.ts";
import { mistralCall, readPagesWithMistral } from "./mistral.ts";
import { fileStore, supabaseStore, type Store } from "./store.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
// tiny settings reader so no extra package is needed. Reads settings.txt, or .env if there is one.
for (const name of [".env", "settings.txt"]) {
  const envFile = join(root, name);
  if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
}
const PORT = Number(process.env.PORT || 5174);
/** Which AI does the reading and grading: Mistral if its key is set, else Claude if its key is set, else a keyword stand-in. */
export interface Setup { provider: "mistral" | "anthropic" | "mock"; model: string | null; call: ModelCall; ocr?: (pages: Page[], onPage?: (page: number, lines: { text: string; y0?: number; y1?: number }[]) => void) => Promise<Page[]>; store: Store }
export function setupFromEnv(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): Setup {
  const mistralBase = env.MISTRAL_BASE_URL || "https://api.mistral.ai";
  const store = env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY ? supabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, fetcher) : fileStore(env.DATA_FILE || (env.VERCEL ? "/tmp/exameval-store.json" : join(root, "data", "store.json")));
  if (env.MISTRAL_API_KEY) {
    const model = env.MISTRAL_MODEL || "mistral-small-latest"; const ocrModel = env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
    return { provider: "mistral", model, call: mistralCall(env.MISTRAL_API_KEY, model, mistralBase), ocr: (pages, onPage) => readPagesWithMistral(env.MISTRAL_API_KEY!, pages, ocrModel, mistralBase, onPage), store };
  }
  if (env.ANTHROPIC_API_KEY) { const model = env.AI_MODEL || "claude-sonnet-5-5"; return { provider: "anthropic", model, call: anthropicCall(env.ANTHROPIC_API_KEY, model), store }; }
  return { provider: "mock", model: null, call: mockCall, store };
}
let setup = setupFromEnv();
export const useSetup = (s: Setup) => { setup = s; };
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

const send = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req: IncomingMessage, limit = 150 * 1024 * 1024) => new Promise<string>((ok, bad) => {
  let n = 0; const parts: Buffer[] = [];
  req.on("data", (c: Buffer) => { n += c.length; if (n > limit) { bad(new Error("Upload too large.")); req.destroy(); } else parts.push(c); });
  req.on("end", () => ok(Buffer.concat(parts).toString("utf8"))); req.on("error", bad);
});

/** If APP_PASSWORD is set, every page and API call asks for it (the browser shows its own sign-in box). Off when it is empty. */
const passwordOk = (req: IncomingMessage) => {
  const pw = process.env.APP_PASSWORD; if (!pw) return true;
  const h = String(req.headers.authorization ?? ""); if (!h.startsWith("Basic ")) return false;
  const given = Buffer.from(h.slice(6), "base64").toString("utf8"); const got = given.slice(given.indexOf(":") + 1);
  return got.length === pw.length && timingSafeEqual(Buffer.from(got), Buffer.from(pw));
};

export const handler = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    if (!passwordOk(req)) { res.writeHead(401, { "www-authenticate": 'Basic realm="ExamEval", charset="UTF-8"', "content-type": "text/plain; charset=utf-8" }); return res.end("Password needed."); }
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") return send(res, 200, { ai: setup.provider === "mock" ? "mock" : "live", provider: setup.provider, model: setup.model, store: setup.store.kind, maxBodyBytes: process.env.VERCEL ? 4_000_000 : null });
    if (url.pathname === "/api/state" && req.method === "GET") { const docs = await setup.store.list(Number(url.searchParams.get("since") || 0)); return send(res, 200, { docs, now: docs.at(-1)?.at ?? Number(url.searchParams.get("since") || 0) }); }
    if (url.pathname === "/api/state" && req.method === "POST") {
      const b = JSON.parse(await readBody(req)) as { docs?: { key?: string; value?: unknown }[] };
      if (!Array.isArray(b.docs) || b.docs.some((d) => typeof d?.key !== "string" || !d.key || d.key.length > 200)) return send(res, 400, { error: "Send {docs:[{key,value}]}." });
      return send(res, 200, { at: await setup.store.put(b.docs as { key: string; value: unknown }[]) });
    }
    if (url.pathname === "/api/doc" && req.method === "GET") { const k = url.searchParams.get("key"); if (!k) return send(res, 400, { error: "Give a key." }); return send(res, 200, { value: await setup.store.get(k) }); }
    if (url.pathname === "/api/scan" && req.method === "POST") {
      const b = JSON.parse(await readBody(req)) as { pages?: Page[]; questions?: QuestionInput[] };
      if (!Array.isArray(b.pages) || !b.pages.length) return send(res, 400, { error: "Add at least one page." });
      if (!Array.isArray(b.questions) || !b.questions.length) return send(res, 400, { error: "No questions were sent." });
      if (b.pages.length > 40) return send(res, 400, { error: "At most 40 pages per script." });
      const t0 = Date.now(); const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
      console.log(`[scan] ${b.pages.length} page(s), ${b.questions.length} question(s)`);
      const pages = setup.ocr ? await setup.ocr(b.pages) : b.pages;
      console.log(`[scan] pages read (${stamp()}); now sorting lines into questions and grading`);
      const r = await evaluateScript(setup.call, pages, b.questions); r.mode = setup.provider === "mock" ? "mock" : "live";
      console.log(`[scan] finished in ${stamp()}${r.warnings.length ? `, ${r.warnings.length} warning(s): ${r.warnings.join(" | ")}` : ""}`);
      return send(res, 200, r);
    }
    if ((url.pathname === "/api/scan/stream" || url.pathname === "/api/scanstream") && req.method === "POST") {
      const b = JSON.parse(await readBody(req)) as { pages?: Page[]; questions?: QuestionInput[] };
      if (!Array.isArray(b.pages) || !b.pages.length) return send(res, 400, { error: "Add at least one page." });
      if (!Array.isArray(b.questions) || !b.questions.length) return send(res, 400, { error: "No questions were sent." });
      if (b.pages.length > 40) return send(res, 400, { error: "At most 40 pages per script." });
      res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" });
      const emit = (e: ScanEvent | { type: "done"; result: unknown } | { type: "error"; message: string }) => { if (!res.writableEnded) res.write(`${JSON.stringify(e)}\n`); };
      const t0 = Date.now(); const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
      console.log(`[scan] ${b.pages.length} page(s), ${b.questions.length} question(s)`);
      try {
        emit({ type: "start", pages: b.pages.length, questions: b.questions.map((q) => ({ id: q.id, label: q.label })) });
        const pages = setup.ocr ? await setup.ocr(b.pages, (page, lines) => emit({ type: "page", page, lines })) : b.pages;
        console.log(`[scan] pages read (${stamp()})`);
        const r = await evaluateScript(setup.call, pages, b.questions, (e) => { if (e.type !== "start") emit(e); }); r.mode = setup.provider === "mock" ? "mock" : "live";
        console.log(`[scan] finished in ${stamp()}${r.warnings.length ? `, ${r.warnings.length} warning(s): ${r.warnings.join(" | ")}` : ""}`);
        emit({ type: "done", result: r });
      } catch (e) { console.log(`[error] ${(e as Error).message}`); emit({ type: "error", message: (e as Error).message }); }
      return res.end();
    }
    // static app
    const dist = join(root, "dist"); let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""); if (p === "/" || p === "\\") p = "/index.html";
    const file = join(dist, p);
    if (!file.startsWith(dist) || !existsSync(file) || !(await stat(file)).isFile()) { res.writeHead(404); return res.end("Not found. Run: npm run build"); }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file));
  } catch (e) { console.log(`[error] ${(e as Error).message}`); if (!res.headersSent) send(res, 500, { error: (e as Error).message }); else res.end(); }
};
export const server = createServer(handler);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => console.log(`ExamEval running at http://localhost:${PORT}\n  AI: ${setup.provider}${setup.model ? ` (${setup.model})` : " (no key found, keyword stand-in only)"}\n  Data: ${setup.store.kind === "supabase" ? "Supabase" : "a file on this computer (set SUPABASE_URL and SUPABASE_SERVICE_KEY to use Supabase)"}`));
}
