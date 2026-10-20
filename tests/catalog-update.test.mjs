import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialProducts, initialSettings } from "../server/catalog.mjs";
import { openStore } from "../server/store.mjs";

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
    legacy.close();
    current = openStore(path);
    assert.equal(current.product("suede-penny").price, 350000);
    assert.equal(current.product("evening-bit").price, 280000);
    assert.equal(current.product("brown-textured").price, 220000);
    assert.equal(current.product("textured-bit").price, 199900);
    assert.equal(current.product("midnight-penny").price, null);
    assert.equal(current.product("brown-textured").published, false);
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

test("official details migrate into existing stores once and preserve later administrator edits", async () => {
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
    };
    delete settings.tiktok;
    delete settings.orderNotificationEmail;
    legacy
      .prepare("INSERT INTO settings VALUES(1,?)")
      .run(JSON.stringify(settings));
    legacy.close();
    store = openStore(path);
    assert.equal(store.settings().phone, "03237205097");
    assert.equal(store.settings().orderNotificationEmail, "");
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
