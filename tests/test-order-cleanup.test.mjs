import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openStore } from "../server/store.mjs";
import {
  archiveOwnerTestRequests,
  testCleanupBefore,
  testCleanupRevision,
} from "../server/test-order-cleanup.mjs";

test("owner cleanup archives historical tests, returns reserved stock once and leaves new orders and configuration intact", async (t) => {
  const store = openStore(":memory:");
  t.after(() => store.db.close());
  const db = store.db;
  const p = store.product("suede-penny");
  p.stock = 17;
  p.stockBySize["7"] = 1;
  store.saveProduct(p);
  const settings = store.settings();
  const old = "2026-10-21T09:00:00.000Z",
    future = "2026-10-21T11:00:00.000Z";
  const data = {
    customer: { name: "Private Test" },
    items: [{ id: p.id, size: "7", quantity: 1 }],
    payment: { method: "bank", status: "paid" },
    totals: { total: 350000 },
  };
  const add = (id, kind, status, created) =>
    db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        randomUUID(),
        "fixture",
        kind,
        status,
        JSON.stringify(data),
        created,
      );
  add("active-test", "order", "processing", old);
  add("delivered-test", "order", "delivered", old);
  add("cancelled-test", "order", "cancelled", old);
  add("support-test", "inquiry", "new", old);
  add("new-order", "order", "pending", future);
  db.prepare("INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?,?)").run(
    "test-review",
    "delivered-test",
    p.id,
    "test-user",
    5,
    "Genuine test text",
    "Test",
    "approved",
    old,
  );
  db.prepare(
    "INSERT INTO email_outbox VALUES(?,?,?,?,?,'pending',0,0,0,?,'','')",
  ).run(
    "queued-test",
    "new_order",
    "active-test",
    "owner@example.test",
    "{}",
    old,
  );
  db.exec("BEGIN IMMEDIATE");
  await archiveOwnerTestRequests(store);
  db.exec("COMMIT");
  for (const id of [
    "active-test",
    "delivered-test",
    "cancelled-test",
    "support-test",
  ])
    assert.ok(
      JSON.parse(
        db.prepare("SELECT data FROM requests WHERE id=?").get(id).data,
      ).archivedAt,
    );
  assert.equal(store.product(p.id).stock, 19);
  assert.equal(store.product(p.id).stockBySize["7"], 3);
  const active = db
    .prepare("SELECT * FROM requests WHERE id=?")
    .get("active-test");
  assert.equal(active.status, "cancelled");
  assert.equal(
    JSON.parse(active.data).testCleanup.previousStatus,
    "processing",
  );
  assert.equal(
    db.prepare("SELECT status FROM reviews WHERE id=?").get("test-review")
      .status,
    "rejected",
  );
  assert.equal(
    db.prepare("SELECT status FROM email_outbox WHERE id=?").get("queued-test")
      .status,
    "archived",
  );
  const fresh = db
    .prepare("SELECT * FROM requests WHERE id=?")
    .get("new-order");
  assert.equal(fresh.status, "pending");
  assert.equal(JSON.parse(fresh.data).archivedAt, undefined);
  assert.deepEqual(store.settings(), settings);
  assert.ok(
    db.prepare("SELECT id FROM migrations WHERE id=?").get(testCleanupRevision),
  );
  db.exec("BEGIN IMMEDIATE");
  await archiveOwnerTestRequests(store);
  db.exec("COMMIT");
  assert.equal(store.product(p.id).stock, 19);
  assert.ok(future > testCleanupBefore);
});

test("a failed cleanup rolls back the archive, returned stock and migration marker together", async (t) => {
  const store = openStore(":memory:");
  t.after(() => store.db.close());
  const p = store.product("suede-penny"),
    db = store.db;
  db.prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)").run(
    "test-order",
    randomUUID(),
    "fixture",
    "order",
    "pending",
    JSON.stringify({ items: [{ id: p.id, size: "7", quantity: 1 }] }),
    "2026-10-21T09:00:00.000Z",
  );
  const save = store.saveProduct;
  store.saveProduct = () => {
    throw new Error("Injected failure");
  };
  db.exec("BEGIN IMMEDIATE");
  await assert.rejects(
    () => archiveOwnerTestRequests(store),
    /Injected failure/,
  );
  db.exec("ROLLBACK");
  store.saveProduct = save;
  assert.equal(
    db.prepare("SELECT status FROM requests WHERE id=?").get("test-order")
      .status,
    "pending",
  );
  assert.equal(
    db.prepare("SELECT id FROM migrations WHERE id=?").get(testCleanupRevision),
    undefined,
  );
  assert.deepEqual(store.product(p.id), p);
});
