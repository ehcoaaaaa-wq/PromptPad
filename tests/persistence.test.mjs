import assert from "node:assert/strict";
import { test } from "node:test";
import { createPersistence } from "../src/lib/persistence.ts";

test("loading must succeed before any mutation can write", async () => {
  let writes = 0;
  const store = createPersistence(0, async () => { writes++; }, () => {});
  await assert.rejects(store.update(() => 1), /禁止写入/);
  assert.equal(writes, 0);
  store.initialize(4);
  await store.update((n) => n + 1);
  assert.equal(store.get(), 5);
});

test("failed save retains persisted state and flush fails until successful retry", async () => {
  let fail = true;
  const store = createPersistence("old", async () => { if (fail) throw new Error("disk full"); }, () => {});
  store.initialize("old");
  await assert.rejects(store.update(() => "draft"), /disk full/);
  assert.equal(store.get(), "old");
  await assert.rejects(store.flush(), /disk full/);
  fail = false;
  await store.update(() => "draft");
  await store.flush();
  assert.equal(store.get(), "draft");
});

test("queued changes use the latest successfully saved state", async () => {
  const writes = [];
  const store = createPersistence(0, async (n) => { writes.push(n); }, () => {});
  store.initialize(0);
  await Promise.all([store.update((n) => n + 1), store.update((n) => n + 1)]);
  assert.deepEqual(writes, [1, 2]);
  assert.equal(store.get(), 2);
});

test("state is not published before disk write finishes", async () => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const store = createPersistence(1, async () => gate, () => {});
  store.initialize(1);
  const pending = store.update(() => 2);
  await Promise.resolve();
  assert.equal(store.get(), 1);
  finish();
  await pending;
  assert.equal(store.get(), 2);
});
