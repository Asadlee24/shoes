import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openStore } from "../server/store.mjs";
import { openPostgresStore } from "../server/postgres.mjs";
import {
  studioGalleryRefreshes,
  studioGalleryRevision,
  refreshedStudioGallery,
} from "../server/gallery-studio-refresh.mjs";

test("studio gallery mapping covers exactly 24 edits and leaves approved covers and unknown uploads unchanged", () => {
  const outputs = new Set(
    studioGalleryRefreshes.flatMap(([, pairs]) => pairs.map(([, to]) => to)),
  );
  assert.equal(outputs.size, 24);
  const [id, pairs] = studioGalleryRefreshes[0];
  const before = {
    id,
    image: "/products/approved-cover.webp",
    images: [
      "/products/approved-cover.webp",
      pairs[0][0],
      "/products/later-owner-upload.jpg",
    ],
    price: 314500,
    stock: 9,
  };
  assert.deepEqual(refreshedStudioGallery(before), {
    ...before,
    images: [before.image, pairs[0][1], before.images[2]],
  });
  const other = { ...before, id: "owner-other-product" };
  assert.equal(refreshedStudioGallery(other), other);
  assert.equal(refreshedStudioGallery(null), null);
});

async function fixture(backend) {
  if (backend === "SQLite") {
    const dir = mkdtempSync(join(tmpdir(), "qf-all-galleries-"));
    let store;
    return {
      async open() {
        store?.db.close();
        store = openStore(join(dir, "store.sqlite"));
        return store;
      },
      async close() {
        store?.db.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  }
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
  return {
    open: () => openPostgresStore({ poolFactory }),
    close: () => database.close(),
  };
}
const write = (store, fn) =>
  store.withRequest ? store.withRequest(true, fn) : fn();

for (const backend of ["SQLite", "Postgres"]) {
  test(`${backend} startup refreshes every rough angle once while preserving covers, commerce and later gallery edits`, async () => {
    const db = await fixture(backend);
    try {
      let store = await db.open();
      const snapshots = [];
      await write(store, async () => {
        for (const [id, pairs] of studioGalleryRefreshes) {
          const current = await store.product(id);
          const product = {
            ...current,
            price: 328900,
            stock: 12,
            stockBySize: { 7: 1, 8: 2, 9: 3, 10: 4, 11: 2 },
            description: "Owner-authored product description",
            imagePosition: "50% 65%",
            images: [
              current.image,
              ...pairs.map(([from]) => from),
              `/products/${id}-owner-detail.webp`,
            ],
          };
          snapshots.push(product);
          await store.saveProduct(product);
        }
        await store.db
          .prepare("DELETE FROM migrations WHERE id=?")
          .run(studioGalleryRevision);
      });
      store = await db.open();
      for (const before of snapshots) {
        const [, pairs] = studioGalleryRefreshes.find(
          ([id]) => id === before.id,
        );
        const expectedImages = [
          before.image,
          ...new Set(pairs.map(([, to]) => to)),
          before.images.at(-1),
        ];
        assert.deepEqual(await store.product(before.id), {
          ...before,
          images: expectedImages,
        });
      }
      const later = {
        ...(await store.product("metro-court-mocha")),
        images: [
          "/products/mocha-cover-studio-v1.webp",
          "/products/new-owner-mocha-angle.jpg",
        ],
      };
      await write(store, () => store.saveProduct(later));
      store = await db.open();
      assert.deepEqual(await store.product(later.id), later);
    } finally {
      await db.close();
    }
  });
}
