import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Doc { key: string; value: unknown; at: number }
/** Where the app's data lives. Documents are small JSON records keyed by name; a null value means deleted. */
export interface Store { kind: "supabase" | "file"; list(since: number): Promise<Doc[]>; get(key: string): Promise<unknown>; put(docs: { key: string; value: unknown }[]): Promise<number> }

/** Page photos are large and fetched one at a time, so they never appear in the change list. */
export const isPrivateKey = (k: string) => k.startsWith("thumb:");
let lastAt = 0;
const stamp = () => { lastAt = Math.max(lastAt + 1, Date.now() * 1000); return lastAt; };

/** A JSON file on disk. Good for trying the app on one computer. */
export function fileStore(path: string): Store {
  const docs = new Map<string, Doc>();
  if (existsSync(path)) { try { for (const d of JSON.parse(readFileSync(path, "utf8")) as Doc[]) { docs.set(d.key, d); lastAt = Math.max(lastAt, d.at); } } catch { /* start empty */ } }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => { if (timer) return; timer = setTimeout(() => { timer = null; try { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify([...docs.values()])); } catch { /* disk unavailable */ } }, 300); };
  return {
    kind: "file",
    async list(since) { return [...docs.values()].filter((d) => d.at > since && !isPrivateKey(d.key)).sort((a, b) => a.at - b.at); },
    async get(key) { const d = docs.get(key); return d ? d.value : null; },
    async put(batch) { let at = 0; for (const b of batch) { at = stamp(); docs.set(b.key, { key: b.key, value: b.value, at }); } save(); return at; },
  };
}

/** Supabase over its REST address, with the service key kept on this server. The table is created by supabase/schema.sql. */
export function supabaseStore(url: string, serviceKey: string, fetcher: typeof fetch = fetch): Store {
  const base = `${url.replace(/\/+$/, "")}/rest/v1/kv`;
  // The older service_role key is a long token starting "eyJ" and is also sent as a bearer token. The newer secret key (sb_secret_...) goes in the apikey header only.
  const h: Record<string, string> = { apikey: serviceKey, "content-type": "application/json", ...(serviceKey.startsWith("eyJ") ? { authorization: `Bearer ${serviceKey}` } : {}) };
  const fail = async (r: Response, what: string) => { throw new Error(`Database error while ${what}: ${r.status} ${(await r.text()).slice(0, 200)}`); };
  return {
    kind: "supabase",
    async list(since) {
      const all: Doc[] = []; let from = since;
      for (;;) {
        const r = await fetcher(`${base}?select=key,value,at&at=gt.${from}&key=not.like.thumb:*&order=at.asc&limit=500`, { headers: h });
        if (!r.ok) await fail(r, "reading");
        const rows = (await r.json()) as Doc[]; all.push(...rows);
        if (rows.length < 500) return all; from = rows[rows.length - 1].at;
      }
    },
    async get(key) {
      const r = await fetcher(`${base}?select=value&key=eq.${encodeURIComponent(key)}`, { headers: h });
      if (!r.ok) await fail(r, "reading a record"); const rows = (await r.json()) as { value: unknown }[]; return rows[0]?.value ?? null;
    },
    async put(batch) {
      let at = 0;
      for (let i = 0; i < batch.length; i += 50) {
        const rows = batch.slice(i, i + 50).map((b) => ({ key: b.key, value: b.value, at: (at = stamp()) }));
        const r = await fetcher(`${base}?on_conflict=key`, { method: "POST", headers: { ...h, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
        if (!r.ok) await fail(r, "saving");
      }
      return at;
    },
  };
}
