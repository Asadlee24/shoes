import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initialProducts,
  initialSettings,
  ownerFreeDeliveryRevision,
  ownerNotificationRevision,
} from "../server/catalog.mjs";
import { openStore } from "../server/store.mjs";
import { ownerStockRevision } from "../server/inventory.mjs";

test("existing stores receive confirmed prices once without overwriting admin edits or inventory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qadam-prices-"));
  const path = join(dir, "legacy.db");
  let current;
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE settings(id INTEGER PRIMARY KEY,data TEXT NOT NULL);",
    );
    legacy
      .prepare("INSERT INTO settings VALUES(1,?)")
      .run(JSON.stringify(initialSettings));
    const insert = legacy.prepare("INSERT INTO products VALUES(?,?)");
    for (const product of initialProducts) {
      insert.run(
        product.id,
        JSON.stringify({
          ...product,
          price: product.id === "textured-bit" ? 199900 : null,
          description: "Administrator's existing description",
          stockBySize: { 7: 3, 8: null, 9: 0, 10: null, 11: null },
        }),
      );
    }
    // Isolate the price migration from the newer, explicitly requested stock reset.
    legacy.exec(
      "CREATE TABLE migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL)",
    );
    legacy
      .prepare("INSERT INTO migrations VALUES(?,?)")
      .run(ownerStockRevision, new Date().toISOString());
    legacy.close();
    current = openStore(path);
    assert.equal(current.product("suede-penny").price, 350000);
    assert.equal(current.product("evening-bit").price, 280000);
    assert.equal(current.product("brown-textured").price, 220000);
    assert.equal(current.product("textured-bit").price, 199900);
    assert.equal(current.product("midnight-penny").price, null);
    assert.equal(current.product("brown-textured").published, true);
    assert.equal(current.product("brown-textured").variantOf, "textured-bit");
    assert.equal(
      current.product("suede-penny").description,
      "Administrator's existing description",
    );
    assert.deepEqual(current.product("suede-penny").stockBySize, {
      7: 3,
      8: null,
      9: 0,
      10: null,
      11: null,
    });
    current.saveProduct({ ...current.product("suede-penny"), price: 123400 });
    current.db.close();
    current = openStore(path);
    assert.equal(current.product("suede-penny").price, 123400);
  } finally {
    current?.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("official details and the corrected private notification recipient migrate once and preserve later administrator edits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qadam-details-"));
  const path = join(dir, "legacy.db");
  let store;
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE settings(id INTEGER PRIMARY KEY,data TEXT NOT NULL);",
    );
    const settings = {
      ...initialSettings,
      instagram: "owner_custom",
      phone: "",
      bankIban: "",
      bankAccountNumber: "",
      easypaisaNumber: "",
      orderNotificationEmail: "asadalay416@gmail.com",
    };
    delete settings.tiktok;
    legacy
      .prepare("INSERT INTO settings VALUES(1,?)")
      .run(JSON.stringify(settings));
    legacy.close();
    store = openStore(path);
    assert.equal(store.settings().phone, "03237205097");
    assert.equal(
      store.settings().orderNotificationEmail,
      "asadaly416@gmail.com",
    );
    assert.equal(
      store.db
        .prepare("SELECT COUNT(*) AS count FROM migrations WHERE id=?")
        .get(ownerNotificationRevision).count,
      1,
    );
    assert.equal(store.settings().instagram, "owner_custom");
    assert.equal(store.settings().tiktok, "qadamflexoffical");
    assert.equal(store.settings().bankAccountNumber, "0011935002260015");
    store.saveSettings({
      ...store.settings(),
      phone: "03001234567",
      easypaisaNumber: "",
      orderNotificationEmail: "new-owner@example.test",
    });
    store.db.close();
    store = openStore(path);
    assert.equal(store.settings().phone, "03001234567");
    assert.equal(store.settings().easypaisaNumber, "");
    assert.equal(
      store.settings().orderNotificationEmail,
      "new-owner@example.test",
    );
  } finally {
    store?.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("owner stock migration sets 20 per style once, preserves business data and later sales", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qadam-stock-"));
  const path = join(dir, "store.db");
  let store;
  try {
    store = openStore(path);
    const before = store.product("suede-penny");
    store.saveProduct({
      ...before,
      price: 399900,
      stock: 7,
      stockBySize: { 7: 1, 8: 2, 9: 2, 10: 1, 11: 1 },
    });
    store.saveSettings({
      ...store.settings(),
      shippingFee: 22500,
      orderNotificationEmail: "owner@example.test",
    });
    store.db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        "stock-test-reference",
        "stock-test-key",
        "fingerprint",
        "inquiry",
        "new",
        JSON.stringify({ customer: { name: "Retained test" }, items: [] }),
        new Date().toISOString(),
      );
    store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(ownerStockRevision);
    store.db.close();
    store = openStore(path);
    for (const id of [
      "suede-penny",
      "textured-bit",
      "evening-bit",
      "midnight-penny",
      "brown-textured",
    ]) {
      const product = store.product(id);
      assert.equal(product.stock, 20);
      assert.deepEqual(product.stockBySize, { 7: 4, 8: 4, 9: 4, 10: 4, 11: 4 });
    }
    assert.equal(store.product(before.id).price, 399900);
    assert.equal(store.product("brown-textured").published, true);
    for (const id of [
      "metro-court-mocha",
      "metro-court-onyx",
      "regent-bit-black-2026",
    ])
      assert.equal(
        store.product(id).stock,
        null,
        "Later styles need their own stock confirmation",
      );
    assert.equal(store.settings().shippingFee, 22500);
    assert.equal(store.settings().orderNotificationEmail, "owner@example.test");
    assert.ok(
      store.db
        .prepare("SELECT id FROM requests WHERE id=?")
        .get("stock-test-reference"),
    );
    const product = store.product(before.id);
    store.saveProduct({
      ...product,
      stock: 19,
      stockBySize: { ...product.stockBySize, 7: 3 },
    });
    store.db.close();
    store = openStore(path);
    assert.equal(store.product(before.id).stock, 19);
    assert.equal(store.product(before.id).stockBySize["7"], 3);
    assert.equal(
      store.db
        .prepare("SELECT COUNT(*) AS count FROM migrations WHERE id=?")
        .get(ownerStockRevision).count,
      1,
    );
  } finally {
    store?.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("owner free delivery fills an existing unset fee once without changing orders or later admin edits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qadam-free-delivery-"));
  const path = join(dir, "store.db");
  let store;
  try {
    store = openStore(path);
    const settings = {
      ...store.settings(),
      shippingFee: null,
      orderNotificationEmail: "owner@example.test",
    };
    store.saveSettings(settings);
    const products = store.products();
    const originalOrder = JSON.stringify({
      totals: { subtotal: 350000, shipping: 20000, total: 370000 },
    });
    store.db
      .prepare("INSERT INTO requests VALUES(?,?,?,?,?,?,?)")
      .run(
        "existing-order",
        "existing-key",
        "fingerprint",
        "order",
        "pending",
        originalOrder,
        new Date().toISOString(),
      );
    store.db
      .prepare("DELETE FROM migrations WHERE id=?")
      .run(ownerFreeDeliveryRevision);
    store.db.close();
    store = openStore(path);
    assert.deepEqual(store.settings(), { ...settings, shippingFee: 0 });
    assert.deepEqual(store.products(), products);
    assert.equal(
      store.db
        .prepare("SELECT data FROM requests WHERE id=?")
        .get("existing-order").data,
      originalOrder,
    );
    store.saveSettings({ ...store.settings(), shippingFee: 22500 });
    store.db.close();
    store = openStore(path);
    assert.equal(store.settings().shippingFee, 22500);
    assert.equal(
      store.db
        .prepare("SELECT COUNT(*) AS count FROM migrations WHERE id=?")
        .get(ownerFreeDeliveryRevision).count,
      1,
    );
  } finally {
    store?.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("Coffee Brown variant is seeded when original placeholder row is missing", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { sqliteCoffee, updateCoffee } =
    await import("../server/coffee-variant.mjs");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL)",
    );
    sqliteCoffee(db);
    const row = db
      .prepare("SELECT data FROM products WHERE id=?")
      .get("brown-textured");
    assert.ok(row, "missing placeholder must be inserted");
    const p = JSON.parse(row.data);
    assert.equal(p.variantOf, "textured-bit");
    assert.equal(p.images.length, 5);
    assert.equal(p.price, 220000);
    const before = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
    sqliteCoffee(db);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM products").get().n,
      before,
    );
    const edited = updateCoffee({ ...p, price: 185000, stockBySize: { 7: 3 } });
    assert.equal(edited.price, 185000);
    assert.equal(edited.stockBySize["7"], 3);
  } finally {
    db.close();
  }
});
