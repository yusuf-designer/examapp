import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; } };
const { actions, getState, attachRemote, sharedPart } = await import("../src/lib/store.ts");

test("shared data syncs between people, but who is signed in stays per device", () => {
  actions.resetDemo(); actions.signIn("u-coe");
  const writes: unknown[] = [];
  const remote = attachRemote((v) => writes.push(v));
  actions.switchUser("u-ev1");
  assert.equal(writes.length, 0, "switching user is not shared");
  const theirs = structuredClone(sharedPart(getState())); theirs.audit = [...theirs.audit];
  theirs.exams[0].name = "Changed by someone else";
  remote.receive(theirs);
  assert.equal(getState().exams[0].name, "Changed by someone else");
  assert.equal(getState().currentUserId, "u-ev1");
  assert.equal(writes.length, 0, "receiving does not echo back");
});
