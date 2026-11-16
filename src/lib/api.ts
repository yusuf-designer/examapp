import { evaluateScript, type ModelCall, type ScanEvent } from "../../server/ai";
import { SAMPLE_PAGES } from "./sample-pages";
import { backend } from "./backend";
import { SAMPLE_PUBLISHED_ID, SAMPLE_SCRIPT_ID } from "./sample-booklet";
import type { Findings, Question } from "./types";

export type Health = { ai: "live" | "mock" | null; model?: string | null; reachable: boolean; maxBodyBytes?: number | null };
export type ScanPage = { kind: "image"; mediaType: string; data: string } | { kind: "pdf"; data: string } | { kind: "text"; text: string }
  | { kind: "reading"; page: number; lines: { text: string; y0?: number; y1?: number; kind?: string; legible?: boolean }[] };
export interface ScanReply { transcript: { page: number; text: string; question: string | null; kind: string; legible: boolean }[]; answers: Record<string, Findings>; warnings: string[]; mode: "live" | "mock" }

/** Inside a published Claude page, Claude itself reads and grades; no server or API key is needed. */
type Sample = ((input: string, opts?: { images?: Blob[]; modelTier?: string }) => Promise<{ text: string }>) & { limits?: () => Promise<{ images?: boolean }> };
async function hostSample(): Promise<Sample | null> {
  try { const c = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude; return c ? ((await c.use("sample")) as Sample | null) : null; } catch { return null; }
}
const toBlob = (b64: string, type: string) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
function sampleCall(sample: Sample): ModelCall {
  return async ({ system, content }) => {
    const images: Blob[] = []; const parts: string[] = [system];
    for (const b of content as { type: string; text?: string; source?: { data: string; media_type: string } }[]) {
      if (b.type === "image" && b.source) images.push(toBlob(b.source.data, b.source.media_type));
      else if (b.type === "document") throw new Error("PDF pages cannot be read here. Upload photos or screenshots of the pages instead.");
      else if (b.text) parts.push(b.text);
    }
    return (await sample(parts.join("\n\n"), images.length ? { images, modelTier: "default" } : { modelTier: "default" })).text;
  };
}

export async function getHealth(): Promise<Health> {
  const host = await hostSample();
  if (host) { const ok = (await host.limits?.().catch(() => null))?.images !== false; return ok ? { ai: "live", model: "Claude, called from this page", reachable: true } : { ai: "mock", reachable: true }; }
  try { const r = await fetch("/api/health"); if (!r.ok) throw new Error(); const j = await r.json(); return { ai: j.ai, model: j.provider === "mistral" ? `Mistral · ${j.model}` : j.provider === "anthropic" ? `Claude · ${j.model}` : j.model, reachable: true, maxBodyBytes: j.maxBodyBytes ?? null }; }
  catch { return { ai: null, reachable: false }; }
}

export async function scanScript(pages: ScanPage[], questions: Question[]): Promise<ScanReply> {
  const host = await hostSample();
  if (host) {
    const r = await evaluateScript(sampleCall(host), pages, questions.map((q) => ({ id: q.id, label: q.label, text: q.text, marks: q.marks, rubric: q.rubric })));
    return { ...r, mode: "live" } as ScanReply;
  }
  const body = JSON.stringify({ pages, questions: questions.map((q) => ({ id: q.id, label: q.label, text: q.text, marks: q.marks, rubric: q.rubric })) });
  let r: Response;
  try { r = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(8 * 60_000) }); }
  catch (e) { throw new Error((e as Error).name === "TimeoutError" ? "The reading took more than 8 minutes, so it was stopped. Try fewer pages, and look at the terminal where the server runs for the reason." : "Cannot reach the ExamEval server. Start it with: npm start, then open http://localhost:5174"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `The server returned an error (${r.status}).`);
  return j as ScanReply;
}

/** Same as scanScript, but the server reports each step as it happens (pages read, lines sorted, each question graded). */
export async function scanStream(pages: ScanPage[], questions: Question[], onEvent: (e: ScanEvent) => void): Promise<ScanReply> {
  const body = JSON.stringify({ pages, questions: questions.map((q) => ({ id: q.id, label: q.label, text: q.text, marks: q.marks, rubric: q.rubric })) });
  let r: Response;
  try { r = await fetch("/api/scanstream", { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(10 * 60_000) }); }
  catch { throw new Error("Cannot reach the ExamEval server. Is it still running in the terminal?"); }
  if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error ?? `The server returned an error (${r.status}).`); }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ""; let result: ScanReply | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const e = JSON.parse(line) as ScanEvent | { type: "done"; result: ScanReply } | { type: "error"; message: string };
    if (e.type === "error") throw new Error(e.message);
    if (e.type === "done") { result = e.result; return; }
    onEvent(e);
  };
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const parts = buf.split("\n"); buf = parts.pop() ?? ""; parts.forEach(handle);
  }
  handle(buf);
  if (!result) throw new Error("The server stopped before it finished. Look at the terminal for the reason.");
  return result;
}

const loadImage = (file: File) => new Promise<HTMLImageElement>((ok, bad) => {
  const url = URL.createObjectURL(file); const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); ok(img); }; img.onerror = () => { URL.revokeObjectURL(url); bad(new Error(`Could not open ${file.name} as an image.`)); }; img.src = url;
});
function shrink(img: HTMLImageElement, max: number, quality: number): string {
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
const fileToBase64 = (file: File) => new Promise<string>((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] ?? ""); fr.onerror = () => bad(new Error(`Could not read ${file.name}.`)); fr.readAsDataURL(file); });

export interface ReadingFile { engine?: string; pages: { page: number; file?: string; lines: { text: string; y0?: number; y1?: number; kind?: string; legible?: boolean }[] }[] }
/** Parse a reading.json made by the OCR notebook. */
export async function parseReading(file: File): Promise<ReadingFile> {
  let j: any; try { j = JSON.parse(await file.text()); } catch { throw new Error(`${file.name} is not a valid reading file.`); }
  if (!Array.isArray(j?.pages) || !j.pages.every((p: any) => Array.isArray(p?.lines))) throw new Error(`${file.name} does not look like a reading file from the OCR notebook.`);
  return { engine: j.engine, pages: j.pages.map((p: any, i: number) => ({ page: Number(p.page) || i + 1, file: p.file, lines: p.lines })) };
}

/** Draw every page of a PDF as a picture, so a scanned PDF is read and cropped like photos. */
async function pdfToImages(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerPort) { const W = (await import("pdfjs-dist/build/pdf.worker.min.mjs?worker&inline")).default as new () => Worker; pdfjs.GlobalWorkerOptions.workerPort = new W(); }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (doc.numPages > 40) throw new Error(`${file.name} has ${doc.numPages} pages. At most 40 pages per answer book.`);
  const out: HTMLCanvasElement[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n); const base = page.getViewport({ scale: 1 }); const scale = Math.min(3, 1800 / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale }); const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise; out.push(c);
  }
  return out;
}
const shrinkCanvas = (c: HTMLCanvasElement, max: number, quality: number) => {
  const k = Math.min(1, max / Math.max(c.width, c.height)); const o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  o.getContext("2d")!.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/jpeg", quality);
};

/** Turn chosen files into pages the server can read. Images are shrunk so a whole answer book uploads quickly. */
/** Some hosts (Vercel) refuse a request over about 4.5 MB. Re-save the pages a little smaller until they fit. */
async function fitPages(pages: ScanPage[], maxBytes: number) {
  const size = () => pages.reduce((n, p) => n + (p.kind === "image" ? p.data.length : 0), 0);
  for (const [max, q] of [[1500, 0.8], [1300, 0.7], [1100, 0.65], [900, 0.6]] as const) {
    if (size() <= maxBytes) return;
    for (const p of pages) if (p.kind === "image") {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("Could not shrink a page.")); i.src = `data:${p.mediaType};base64,${p.data}`; });
      p.data = shrink(img, max, q).split(",")[1];
    }
  }
  if (size() > maxBytes) throw new Error("These pages are too large to send together. Upload fewer pages at a time, or smaller photos.");
}
export async function prepareFiles(files: File[], maxBytes?: number | null): Promise<{ pages: ScanPage[]; thumbs: string[] }> {
  const pages: ScanPage[] = []; const thumbs: string[] = [];
  for (const f of files) {
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      for (const c of await pdfToImages(f)) { pages.push({ kind: "image", mediaType: "image/jpeg", data: shrinkCanvas(c, 1800, 0.85).split(",")[1] }); thumbs.push(shrinkCanvas(c, 1000, 0.6)); }
    } else if (f.type.startsWith("image/")) {
      const img = await loadImage(f);
      pages.push({ kind: "image", mediaType: "image/jpeg", data: shrink(img, 1800, 0.85).split(",")[1] });
      thumbs.push(shrink(img, 1000, 0.6));
    } else throw new Error(`${f.name} is not an image or PDF.`);
  }
  if (maxBytes) await fitPages(pages, maxBytes);
  return { pages, thumbs };
}

const TKEY = (id: string) => `exameval.scan.${id}`;
type PageDoc = { get: () => Promise<unknown>; set: (v: unknown) => Promise<unknown> };
async function dbDoc(path: string): Promise<PageDoc | null> {
  try { const c = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude; const db = c ? ((await c.use("db")) as { doc: (p: string) => PageDoc } | null) : null; return db ? db.doc(path) : null; } catch { return null; }
}
const readDoc = async (path: string): Promise<{ json?: string } | null> => {
  try { const d = await dbDoc(path); const snap = (await d?.get()) as { exists?: boolean; data?: () => { json?: string } } | undefined; if (!snap || snap.exists === false) return null; return typeof snap.data === "function" ? snap.data() : (snap as { json?: string }); } catch { return null; }
};
/** Keep page photos on this device and, inside Claude, share them one page per record so every evaluator sees the same scan. */
export function saveThumbs(scriptId: string, thumbs: string[]) {
  try { localStorage.setItem(TKEY(scriptId), JSON.stringify(thumbs)); } catch { /* too big for this browser: skip */ }
  if (backend.server) { fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs: [{ key: `thumb:${scriptId}`, value: thumbs }] }) }).catch(() => { /* stays on this device */ }); return; }
  (async () => {
    const head = await dbDoc(`thumbs/${scriptId}`); if (!head) return;
    for (let i = 0; i < thumbs.length; i++) await (await dbDoc(`thumbs/${scriptId}-${i}`))?.set({ json: JSON.stringify(thumbs[i]) });
    await head.set({ json: JSON.stringify({ n: thumbs.length }) });
  })().catch(() => { /* sharing failed: stays on this device */ });
}
export function loadThumbs(scriptId: string): string[] { if (scriptId === SAMPLE_SCRIPT_ID || scriptId === SAMPLE_PUBLISHED_ID) return SAMPLE_PAGES; try { return JSON.parse(localStorage.getItem(TKEY(scriptId)) ?? "[]"); } catch { return []; } }
export async function fetchThumbs(scriptId: string): Promise<string[]> {
  const local = loadThumbs(scriptId); if (local.length) return local;
  if (backend.server) {
    try { const r = await fetch(`/api/doc?key=${encodeURIComponent(`thumb:${scriptId}`)}`); const list = ((await r.json()) as { value: string[] | null }).value ?? [];
      if (list.length) try { localStorage.setItem(TKEY(scriptId), JSON.stringify(list)); } catch { /* ignore */ } return list; } catch { return []; }
  }
  try {
    const head = await readDoc(`thumbs/${scriptId}`); if (!head?.json) return [];
    const parsed = JSON.parse(head.json); const n = typeof parsed?.n === "number" ? parsed.n : 0;
    const list: string[] = [];
    for (let i = 0; i < n; i++) { const d = await readDoc(`thumbs/${scriptId}-${i}`); if (d?.json) list.push(JSON.parse(d.json)); }
    if (list.length) try { localStorage.setItem(TKEY(scriptId), JSON.stringify(list)); } catch { /* ignore */ }
    return list;
  } catch { return []; }
}
