import { attachRemote, sharedPart } from "./store";
import { startHttpSync } from "./sync-http";

type Doc = { get: () => Promise<{ exists?: boolean; data?: () => unknown } | unknown>; set: (v: unknown) => Promise<unknown>; onSnapshot: (cb: (snap: unknown) => void, err?: (e: unknown) => void) => () => void };
type Db = { doc: (path: string) => Doc };
export type SyncStatus = "off" | "connecting" | "shared" | "error";

/** Share the app data between everyone who opens the published page. Does nothing outside Claude. */
export async function startSync(onStatus: (s: SyncStatus) => void) {
  try {
    // Running on its own server: share through that server and its database.
    const h = await fetch("/api/health").then((r) => (r.ok ? r.json() : null)).catch(() => null) as { store?: string } | null;
    if (h?.store) { await startHttpSync(onStatus); return; }
    const c = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude;
    const db = c ? ((await c.use("db")) as Db | null) : null;
    if (!db) { onStatus("off"); return; }
    onStatus("connecting");
    const doc = db.doc("app/state");
    let pending = false; let timer: ReturnType<typeof setTimeout> | null = null; let latest: ReturnType<typeof sharedPart> | null = null;
    const flush = () => { timer = null; if (!latest) return; const v = latest; latest = null; doc.set({ json: JSON.stringify(v), at: Date.now() }).catch(() => onStatus("error")); };
    const remote = attachRemote((v) => { latest = v; if (!timer) timer = setTimeout(flush, 400); });
    const wait = setTimeout(() => onStatus("error"), 10000);
    doc.onSnapshot((snap: any) => {
      clearTimeout(wait);
      const data = snap?.exists === false ? null : (typeof snap?.data === "function" ? snap.data() : snap);
      if (!data?.json) { if (!pending) { pending = true; remote.seed(); } onStatus("shared"); return; }
      try { remote.receive(JSON.parse(data.json)); onStatus("shared"); } catch { onStatus("error"); }
    }, () => onStatus("error"));
  } catch { onStatus("off"); }
}
