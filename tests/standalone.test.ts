import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; }, removeItem(k: string) { delete this._d[k]; } };
const { parseOcrPage, mistralCall, readPagesWithMistral } = await import("../server/mistral.ts");
const { fileStore, supabaseStore } = await import("../server/store.ts");
const { server, setupFromEnv, useSetup } = await import("../server/index.ts");
const { shard, assemble, startHttpSync } = await import("../src/lib/sync-http.ts");
const { actions, getState, sharedPart } = await import("../src/lib/store.ts");
const { seedState } = await import("../src/lib/seed.ts");
const { backend } = await import("../src/lib/backend.ts");

const listen = (s: Server) => new Promise<number>((ok) => s.listen(0, "127.0.0.1", () => ok((s.address() as any).port)));
const body = (req: any) => new Promise<string>((ok) => { let d = ""; req.on("data", (c: any) => (d += c)); req.on("end", () => ok(d)); });

test("OCR replies are turned into lines with positions, whichever way the box is written", () => {
  assert.deepEqual(parseOcrPage({ dimensions: { height: 1000 }, blocks: [{ type: "text", content: "Hello one", top_left_y: 100, bottom_right_y: 200 }, { type: "header", content: "skip", top_left_y: 1, bottom_right_y: 5 }] }),
    [{ text: "Hello one", y0: 0.1, y1: 0.2 }]);
  assert.deepEqual(parseOcrPage({ dimensions: { height: 2000 }, blocks: [{ label: "text", content: "Hello two", y: 400, height: 200 }] }), [{ text: "Hello two", y0: 0.2, y1: 0.3 }]);
  assert.deepEqual(parseOcrPage({ blocks: [{ label: "list", text: "Hello three", bounding_box: { y: 0.25, height: 0.1 } }] }), [{ text: "Hello three", y0: 0.25, y1: 0.35 }]);
  assert.deepEqual(parseOcrPage({ markdown: "line a\n\nline b", blocks: [] }), [{ text: "line a" }, { text: "line b" }]);
});

// A pretend Mistral: OCR returns two paragraphs per photo; chat sorts lines and grades.
function fakeMistral() {
  const seen: { path: string; auth: string; body: any }[] = [];
  const srv = createServer(async (req, res) => {
    const b = JSON.parse((await body(req)) || "{}"); seen.push({ path: req.url!, auth: String(req.headers.authorization), body: b });
    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/ocr") return res.end(JSON.stringify({ pages: [{ dimensions: { height: 1000 }, blocks: [{ type: "text", content: "Question 3", top_left_y: 50, bottom_right_y: 100 }, { type: "text", content: "Atria contract first", top_left_y: 200, bottom_right_y: 300 }] }] }));
    const text = JSON.stringify(b.messages);
    const reply = text.includes("Questions on the paper") ? { labels: [{ i: 0, question: "Question 3" }, { i: 1, question: "Question 3" }] }
      : { points: [], diagram: { present: false }, terms_found: [], critical_error: { found: false } };
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
  });
  return { srv, seen };
}

test("Mistral reads each photo, the model sorts the lines, and the answer keeps its page and position", async () => {
  const fm = fakeMistral(); const port = await listen(fm.srv); const base = `http://127.0.0.1:${port}`;
  try {
    const pages = await readPagesWithMistral("KEY", [{ kind: "image", mediaType: "image/jpeg", data: "AAAA" }, { kind: "text", text: "typed" }], "mistral-ocr-latest", base);
    assert.equal(pages[0].kind, "reading"); assert.equal((pages[0] as any).page, 1); assert.equal(pages[1].kind, "text");
    assert.equal(fm.seen[0].auth, "Bearer KEY"); assert.equal(fm.seen[0].body.include_blocks, true); assert.match(fm.seen[0].body.document.image_url, /^data:image\/jpeg;base64,AAAA/);
    await assert.rejects(readPagesWithMistral("K", [{ kind: "pdf", data: "x" }], "m", base), /photos/);
    const out = await mistralCall("KEY", "mistral-large-latest", base)({ system: "s", maxTokens: 10, content: [{ type: "text", text: "hi" }, { type: "image", source: { media_type: "image/png", data: "BBB" } }] });
    assert.ok(out.length > 0); const chat = fm.seen.find((x) => x.path === "/v1/chat/completions")!;
    assert.equal(chat.body.model, "mistral-large-latest"); assert.equal(chat.body.temperature, 0); assert.equal(chat.body.top_p, 1, "Mistral refuses greedy sampling unless top_p is 1"); assert.equal(chat.body.messages[1].content[1].image_url, "data:image/png;base64,BBB");
  } finally { fm.srv.close(); }
});

test("the server with Mistral keys scans a photo end to end and reports its provider", async () => {
  const fm = fakeMistral(); const mport = await listen(fm.srv);
  const dir = mkdtempSync(join(tmpdir(), "exameval-"));
  useSetup(setupFromEnv({ MISTRAL_API_KEY: "KEY", MISTRAL_BASE_URL: `http://127.0.0.1:${mport}`, DATA_FILE: join(dir, "s.json") } as any));
  const port = await listen(server); const url = `http://127.0.0.1:${port}`;
  try {
    const h = await (await fetch(`${url}/api/health`)).json() as any; assert.equal(h.provider, "mistral"); assert.equal(h.ai, "live"); assert.equal(h.store, "file");
    const q = seedState().exams.find((e) => e.id === "ex-phy2w")!.questions[1];
    const r = await (await fetch(`${url}/api/scan`, { method: "POST", body: JSON.stringify({ pages: [{ kind: "image", mediaType: "image/jpeg", data: "AAAA" }], questions: [{ id: q.id, label: "Question 3", text: q.text, marks: q.marks, rubric: q.rubric }] }) })).json() as any;
    assert.equal(r.mode, "live"); const t = r.answers[q.id].transcript; assert.ok(t.length >= 1, JSON.stringify(r).slice(0, 300));
    assert.ok(t.every((l: any) => l.page === 1)); assert.ok(t.some((l: any) => l.y0 === 0.2 && l.y1 === 0.3));
  } finally { server.close(); fm.srv.close(); }
});

test("the file store lists only newer changes, hides page photos from the list, and keeps deletions", async () => {
  const st = fileStore(join(mkdtempSync(join(tmpdir(), "exameval-")), "s.json"));
  const a = await st.put([{ key: "users:u1", value: { id: "u1" } }, { key: "thumb:S1", value: ["data:x"] }]);
  const b = await st.put([{ key: "users:u1", value: null }, { key: "users:u2", value: { id: "u2" } }]);
  assert.ok(b > a);
  assert.deepEqual((await st.list(0)).map((d) => d.key), ["users:u1", "users:u2"]); assert.equal((await st.list(0))[0].value, null);
  assert.deepEqual((await st.list(a)).map((d) => d.key), ["users:u1", "users:u2"]);
  assert.deepEqual(await st.get("thumb:S1"), ["data:x"]); assert.equal(await st.get("nope"), null);
});

test("the Supabase store talks to the REST address with the service key, upserts, and pages through results", async () => {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const rows = Array.from({ length: 501 }, (_, i) => ({ key: `scripts:s${i}`, value: { id: `s${i}` }, at: i + 1 }));
  const fetcher = (async (url: string, init: any = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers, body: init.body });
    if (init.method === "POST") return new Response("", { status: 201 });
    const from = Number(/at=gt\.(\d+)/.exec(url)?.[1] ?? 0); return new Response(JSON.stringify(rows.filter((r) => r.at > from).slice(0, 500)), { status: 200 });
  }) as unknown as typeof fetch;
  const st = supabaseStore("https://x.supabase.co/", "SERVICE", fetcher);
  const all = await st.list(0); assert.equal(all.length, 501);
  assert.match(calls[0].url, /^https:\/\/x\.supabase\.co\/rest\/v1\/kv\?select=key,value,at&at=gt\.0&key=not\.like\.thumb:\*&order=at\.asc&limit=500$/);
  assert.equal(calls[0].headers.apikey, "SERVICE"); assert.equal(calls[0].headers.authorization, undefined, "a new-style secret key is sent as apikey only");
  const legacy: any[] = []; await supabaseStore("https://x.supabase.co", "eyJhbGciOi", (async (u: string, i: any) => { legacy.push(i.headers); return new Response("[]"); }) as unknown as typeof fetch).list(0);
  assert.equal(legacy[0].authorization, "Bearer eyJhbGciOi");
  await st.put([{ key: "meta", value: { seq: 1 } }]); const post = calls.at(-1)!;
  assert.match(post.url, /on_conflict=key/); assert.match(post.headers.prefer, /merge-duplicates/); assert.equal(JSON.parse(post.body!)[0].key, "meta");
  const failing = supabaseStore("https://x.supabase.co", "S", (async () => new Response("no table", { status: 404 })) as unknown as typeof fetch);
  await assert.rejects(failing.list(0), /Database error while reading: 404/);
});

test("shared data splits into small records and comes back exactly, in the same order", () => {
  for (const full of [seedState(), (actions.resetAll(), sharedPart(getState()))]) {
    const shared = sharedPart(full as any); const docs = shard(shared as any);
    assert.ok(Object.keys(docs).includes("meta") && Object.keys(docs).some((k) => k.startsWith("exams:")));
    const back = assemble(new Map(Object.entries(docs)))!;
    assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(shared)));
  }
});

test("the app syncs through its own server: local changes are saved there and changes from others arrive", async () => {
  useSetup(setupFromEnv({ DATA_FILE: join(mkdtempSync(join(tmpdir(), "exameval-")), "s.json") } as any));
  const port = await listen(server); const real = globalThis.fetch;
  globalThis.fetch = ((u: any, i: any) => real(typeof u === "string" && u.startsWith("/") ? `http://127.0.0.1:${port}${u}` : u, i)) as typeof fetch;
  let stop = () => {};
  try {
    actions.resetAll(); actions.signIn("u-coe");
    stop = await startHttpSync(() => {}, 40); assert.equal(backend.server, true); await new Promise((r) => setTimeout(r, 700));
    const first = (await (await fetch("/api/state?since=0")).json()) as any; assert.ok(first.docs.some((d: any) => d.key === "meta"), "the clean start was saved");
    actions.addScannedScript("ex-phy2", "PHY-4001", "", Object.fromEntries(getState().exams[0].questions.map((q) => [q.id, { pointMarks: {}, diagram: { present: false, elementsFound: [] }, termsFound: [], criticalError: false, evidence: {}, secondPassTotal: 0, transcript: [] }])) as any, 1, [], { name: "Sara Mir", rollNo: "2025-0777" });
    await new Promise((r) => setTimeout(r, 900));
    const after = (await (await fetch("/api/state?since=0")).json()) as any;
    assert.ok(after.docs.some((d: any) => d.key === "scripts:PHY-4001" && d.value), "the new script was saved as its own record");
    assert.ok(after.docs.some((d: any) => d.key.startsWith("users:u-s-20250777")));
    // someone else adds a user on another computer
    await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs: [{ key: "users:u-new", value: { id: "u-new", name: "New Evaluator", role: "evaluator", _o: 99 } }] }) });
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(getState().users.some((u) => u.id === "u-new"), "their change arrived here");
    assert.equal(getState().currentUserId, "u-coe", "who is signed in here did not change");
  } finally { stop(); globalThis.fetch = real; server.close(); backend.server = false; }
});
