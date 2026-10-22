import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openStore } from "../server/store.mjs";
import { openPostgresStore } from "../server/postgres.mjs";
import {
  studioCoverRefreshes,
  studioCoverRevision,
} from "../server/studio-cover-refresh.mjs";

async function legacyCatalog(store) {
  const snapshots = [];
  for (const [id, original] of studioCoverRefreshes) {
    const product = {
      ...(await store.product(id)),
      image: original,
      images: [original, `/products/${id}-owner-detail.jpg`],
      imagePosition: "50% 70%",
      price: 345600,
      stock: 13,
      stockBySize: { 7: 1, 8: 3, 9: 4, 10: 2, 11: 3 },
      description: "Owner-edited description",
    };
    snapshots.push(product);
    await store.saveProduct(product);
  }
  const untouched = { ...(await store.product("suede-penny")), price: 456700 };
  await store.saveProduct(untouched);
  await store.db
    .prepare("DELETE FROM migrations WHERE id=?")
    .run(studioCoverRevision);
  return { snapshots, untouched };
}

async function verifyCatalog(store, { snapshots, untouched }) {
  for (const before of snapshots) {
    const [, original, replacement] = studioCoverRefreshes.find(
      ([id]) => id === before.id,
    );
    assert.deepEqual(await store.product(before.id), {
      ...before,
      image: replacement,
      imagePosition: "50% 50%",
      images: [replacement, original, before.images[1]],
    });
  }
  assert.deepEqual(await store.product(untouched.id), untouched);
}

test("SQLite startup refreshes all five legacy covers, retains originals and preserves later edits", async () => {
  const dir = mkdtempSync(join(tmpdir(), "qf-cover-test-"));
  const filename = join(dir, "store.sqlite");
  let store;
  try {
    store = openStore(filename);
    const before = await legacyCatalog(store);
    // A different administrator cover must win even before the migration runs.
    const ownerCover = {
      ...before.snapshots.pop(),
      image: "/products/owner-new-cover.jpg",
    };
    store.saveProduct(ownerCover);
    store.db.close();
    store = openStore(filename);
    await verifyCatalog(store, before);
    assert.deepEqual(store.product(ownerCover.id), ownerCover);
    const future = {
      ...store.product("evening-bit"),
      image: "/products/future-cover.jpg",
    };
    store.saveProduct(future);
    store.db.close();
    store = openStore(filename);
    assert.deepEqual(store.product(future.id), future);
  } finally {
    store?.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Postgres startup upgrades all five first photos once and retains commercial data", async () => {
  const database = new PGlite();
  const query = async (sql, values = []) => {
    const results =
      !values.length && sql.trim().split(";").filter(Boolean).length > 1
        ? await database.exec(sql)
        : [await database.query(sql, values)];
    const result = results.at(-1);
    return {
      ...result,
      rowCount: result.affectedRows ?? result.rows?.length ?? 0,
    };
  };
  const poolFactory = async () => ({
    query,
    async connect() {
      return { query, release() {} };
    },
    async end() {},
  });
  try {
    let store = await openPostgresStore({ poolFactory });
    const before = await store.withRequest(true, () => legacyCatalog(store));
    store = await openPostgresStore({ poolFactory });
    await verifyCatalog(store, before);
    const future = {
      ...(await store.product("regent-bit-black-2026")),
      image: "/products/later-regent-cover.jpg",
    };
    await store.withRequest(true, () => store.saveProduct(future));
    store = await openPostgresStore({ poolFactory });
    assert.deepEqual(await store.product(future.id), future);
  } finally {
    await database.close();
  }
});
