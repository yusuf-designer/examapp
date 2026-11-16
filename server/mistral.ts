import type { ModelCall, Page } from "./ai";

const BASE = "https://api.mistral.ai";
const WAIT_MS = 45_000; // a call that takes longer than this is treated as failed instead of hanging forever
const log = (msg: string) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const timed = async <T>(what: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const t0 = Date.now();
  try { const r = await run(AbortSignal.timeout(WAIT_MS)); log(`${what}: done in ${((Date.now() - t0) / 1000).toFixed(1)}s`); return r; }
  catch (e) { const m = (e as Error).name === "TimeoutError" ? `no answer from Mistral after ${WAIT_MS / 1000}s` : (e as Error).message; log(`${what}: FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s, ${m}`); throw new Error(`${what} failed: ${m}`); }
};

/** Chat model call over Mistral's API, used to sort lines into questions and to grade. Same shape as the Claude call. */
export function mistralCall(apiKey: string, model: string, base = BASE): ModelCall {
  return async ({ system, content, maxTokens }) => {
    const parts = (content as { type: string; text?: string; source?: { media_type: string; data: string } }[]).flatMap((b): Record<string, string>[] =>
      b.type === "text" ? [{ type: "text", text: b.text ?? "" }]
      : b.type === "image" && b.source ? [{ type: "image_url", image_url: `data:${b.source.media_type};base64,${b.source.data}` }] : []);
    const what = system.includes("sort lines") ? "sorting lines into questions" : "grading an answer";
    let last: Error = new Error("no attempt made");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await timed(`Mistral ${what} (${model}, try ${attempt})`, async (signal) => {
          const res = await fetch(`${base}/v1/chat/completions`, { signal,
            method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, temperature: 0, top_p: 1, max_tokens: Math.min(maxTokens, 2500), ...(attempt < 2 ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: system }, { role: "user", content: parts }] }),
          });
          if (!res.ok) throw new Error(`AI service error ${res.status}: ${(await res.text()).slice(0, 300)}`);
          const j = (await res.json()) as { choices?: { message?: { content?: string | { type: string; text?: string }[] } }[] };
          const c = j.choices?.[0]?.message?.content;
          const text = typeof c === "string" ? c : (c ?? []).map((x) => x.text ?? "").join("");
          if (!text.trim()) throw new Error("AI service error 502: empty reply");
          return text;
        });
      } catch (e) {
        last = e as Error;
        const retry = /no answer from Mistral|error (429|5\d\d)|empty reply|fetch failed/.test(last.message);
        if (!retry || attempt === 3) break;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    throw last;
  };
}

type Line = { text: string; y0?: number; y1?: number; kind?: "text" | "diagram" };
type Box = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const SKIP = new Set(["header", "footer", "page_number", "image", "figure"]);

/** The vertical extent of a block, whichever way the OCR reply spells its box. */
function yOf(b: Box): [number | undefined, number | undefined] {
  if (num(b.top_left_y) !== undefined && num(b.bottom_right_y) !== undefined) return [num(b.top_left_y), num(b.bottom_right_y)];
  if (num(b.y) !== undefined && num(b.height) !== undefined) return [num(b.y), num(b.y)! + num(b.height)!];
  const bb = (b.bounding_box ?? b.bbox ?? b.box) as unknown;
  if (Array.isArray(bb) && bb.length >= 4) return [num(bb[1]), num(bb[3])];
  if (bb && typeof bb === "object") {
    const o = bb as Box;
    if (num(o.y) !== undefined && num(o.height) !== undefined) return [num(o.y), num(o.y)! + num(o.height)!];
    if (num(o.top_left_y) !== undefined) return [num(o.top_left_y), num(o.bottom_right_y)];
    if (num(o.y0) !== undefined) return [num(o.y0), num(o.y1)];
  }
  return [undefined, undefined];
}

/** Turn one page of an OCR reply into lines with their position on the page (0 at the top, 1 at the bottom). */
export function parseOcrPage(pg: { markdown?: string; blocks?: Box[]; dimensions?: { height?: number } }, imageHeight = 1): Line[] {
  const raw = (pg.blocks ?? []).flatMap((b) => {
    const label = String(b.label ?? b.type ?? "text").toLowerCase(); const text = String(b.content ?? b.text ?? b.markdown ?? "").replace(/\s+/g, " ").trim();
    if (!text || SKIP.has(label)) return [];
    const [y0, y1] = yOf(b); return [{ text, y0, y1 }];
  });
  const top = Math.max(0, ...raw.flatMap((r) => [r.y0 ?? 0, r.y1 ?? 0]));
  const div = top <= 1.5 ? 1 : (pg.dimensions?.height || imageHeight);
  const lines: Line[] = raw.map((r) => (r.y0 !== undefined && r.y1 !== undefined && r.y1 > r.y0
    ? { text: r.text, y0: Math.round(Math.max(0, Math.min(1, r.y0 / div)) * 1e4) / 1e4, y1: Math.round(Math.max(0, Math.min(1, r.y1 / div)) * 1e4) / 1e4 } : { text: r.text }));
  if (lines.length) return lines;
  return (pg.markdown ?? "").split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).map((text) => ({ text })); // no positions: the app shows the whole page
}

/** Read one photographed page with Mistral OCR. */
export async function mistralOcrPage(apiKey: string, page: { mediaType: string; data: string }, pageNo: number, ocrModel: string, base = BASE): Promise<Page> {
  const body = JSON.stringify({ model: ocrModel, document: { type: "image_url", image_url: `data:${page.mediaType};base64,${page.data}` }, include_blocks: true });
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await timed(`Mistral OCR, page ${pageNo}`, (signal) => fetch(`${base}/v1/ocr`, { method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body }));
    if (res.ok) { const j = (await res.json()) as { pages?: Parameters<typeof parseOcrPage>[0][] }; return { kind: "reading", page: pageNo, lines: parseOcrPage(j.pages?.[0] ?? {}) }; }
    last = `${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (![429, 500, 502, 503].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`OCR service error ${last}`);
}

/** Read every photographed page, three at a time. Typed text and finished readings pass through unchanged. */
export async function readPagesWithMistral(apiKey: string, pages: Page[], ocrModel: string, base = BASE, onPage?: (page: number, lines: Line[]) => void): Promise<Page[]> {
  const out: Page[] = new Array(pages.length); let next = 0;
  const worker = async () => { for (;;) { const i = next++; if (i >= pages.length) return; const p = pages[i];
    if (p.kind === "pdf") throw new Error("Upload photos of the pages. PDFs are not read in this setup yet.");
    out[i] = p.kind === "image" ? await mistralOcrPage(apiKey, p, i + 1, ocrModel, base) : p;
    if (out[i].kind === "reading") onPage?.(i + 1, (out[i] as { lines: Line[] }).lines); } };
  await Promise.all(Array.from({ length: Math.min(5, pages.length) }, worker));
  return out;
}
