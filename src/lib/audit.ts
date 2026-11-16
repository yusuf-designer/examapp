import { sha256 } from "./hash";
import type { AuditEntry } from "./types";
export const GENESIS = "0".repeat(64);
export function entryHash(e: Omit<AuditEntry, "hash">): string {
  return sha256(JSON.stringify([e.seq, e.ts, e.actorId, e.actorRole, e.action, e.target, e.detail, e.reason ?? "", e.prevHash]));
}
export function makeEntry(prev: AuditEntry | undefined, f: Omit<AuditEntry, "seq" | "prevHash" | "hash">): AuditEntry {
  const base = { ...f, seq: (prev?.seq ?? 0) + 1, prevHash: prev?.hash ?? GENESIS };
  return { ...base, hash: entryHash(base) };
}
/** Returns the sequence number of the first broken entry, or null if the chain is intact. */
export function verifyChain(log: AuditEntry[]): number | null {
  let prev = GENESIS;
  for (const e of log) {
    if (e.prevHash !== prev || entryHash(e) !== e.hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
