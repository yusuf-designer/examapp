import { attachRemote, sharedPart } from "./store";
import { backend } from "./backend";
import type { SyncStatus } from "./sync";

type Shared = ReturnType<typeof sharedPart>;
const COLLECTIONS = ["users", "exams", "scripts", "batches", "evaluations", "editRequests", "rechecks"] as const;
type Item = { id: string } & Record<string, unknown>;

/** Split the shared data into small records so changing one mark saves one script, not the whole college. */
export function shard(s: Shared): Record<string, unknown> {
  const docs: Record<string, unknown> = {
    meta: { seq: s.seq, assignedExamIds: s.assignedExamIds, dataVersion: s.dataVersion ?? null },
    audit: s.audit,
  };
  for (const c of COLLECTIONS) (s[c] as unknown as Item[]).forEach((item, i) => { docs[`${c}:${item.id}`] = { ...item, _o: i }; });
  return docs;
}
/** Put the records back together in their original order. */
export function assemble(docs: Map<string, unknown>): Shared | null {
  const meta = docs.get("meta") as { seq: number; assignedExamIds: string[]; dataVersion: number | null } | undefined;
  if (!meta) return null;
  const out: Record<string, unknown> = { seq: meta.seq, assignedExamIds: meta.assignedExamIds, audit: (docs.get("audit") as unknown[]) ?? [] };
  if (meta.dataVersion != null) out.dataVersion = meta.dataVersion;
  for (const c of COLLECTIONS) {
    const items: { _o: number }[] = [];
    for (const [k, v] of docs) if (k.startsWith(`${c}:`) && v) items.push(v as { _o: number });
    out[c] = items.sort((a, b) => a._o - b._o).map(({ _o, ...rest }) => rest);
  }
  return out as unknown as Shared;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json() as Promise<T>;
}
export const putDocs = (docs: { key: string; value: unknown }[]) => api<{ at: number }>("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs }) });

/** Share data through this app's own server, which keeps it in Supabase. Polls every few seconds for other people's changes. */
export async function startHttpSync(onStatus: (s: SyncStatus) => void, every = 3000): Promise<() => void> {
  onStatus("connecting"); backend.server = true;
  const known = new Map<string, string>(); const values = new Map<string, unknown>(); let since = 0; let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null; let latest: Shared | null = null;
  const flush = async () => {
    timer = null; if (!latest) return; const next = shard(latest); latest = null;
    const changes: { key: string; value: unknown }[] = [];
    for (const [k, v] of Object.entries(next)) { const j = JSON.stringify(v); if (known.get(k) !== j) { changes.push({ key: k, value: v }); known.set(k, j); values.set(k, v); } }
    for (const k of [...known.keys()]) if (!(k in next)) { changes.push({ key: k, value: null }); known.delete(k); values.delete(k); }
    if (!changes.length) return;
    try { await putDocs(changes); onStatus("shared"); } catch { onStatus("error"); }
  };
  const remote = attachRemote((v) => { latest = v; if (!timer) timer = setTimeout(flush, 400); });
  const pull = async (): Promise<boolean> => {
    const r = await api<{ docs: { key: string; value: unknown; at: number }[] }>(`/api/state?since=${since}`);
    let changed = false;
    for (const d of r.docs) {
      since = Math.max(since, d.at); const j = JSON.stringify(d.value);
      if (d.value === null) { if (known.delete(d.key)) { values.delete(d.key); changed = true; } continue; }
      if (known.get(d.key) !== j) { known.set(d.key, j); values.set(d.key, d.value); changed = true; }
    }
    return changed;
  };
  try {
    await pull(); const first = assemble(values);
    if (first) remote.receive(first); else remote.seed();
    onStatus("shared");
  } catch { onStatus("error"); }
  const loop = async () => {
    if (stopped) return;
    try { if (!timer && (await pull())) { const s = assemble(values); if (s) remote.receive(s); } onStatus("shared"); } catch { onStatus("error"); }
    if (!stopped) setTimeout(loop, every);
  };
  setTimeout(loop, every);
  return () => { stopped = true; };
}
