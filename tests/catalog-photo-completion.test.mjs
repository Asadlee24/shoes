import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openStore } from "../server/store.mjs";
import { openPostgresStore } from "../server/postgres.mjs";
import {
  completedCovers,
  cleanedGalleryPhotos,
  coffeeScreenshot,
  photoCompletionRevision,
} from "../server/catalog-photo-completion.mjs";

async function fixture(backend) {
  if (backend === "SQLite") {
    const dir = mkdtempSync(join(tmpdir(), "qf-complete-photos-"));
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
  test(`${backend} startup completes every remaining cover, cleans hand photos and preserves owner edits`, async () => {
    const db = await fixture(backend);
    try {
      let store = await db.open();
      const before = [];
      const expected = new Map();
      const ownerId = "product-4138da06";
      await write(store, async () => {
        for (const [id, original, replacement] of completedCovers) {
          const extra = `/products/${id}-owner-detail.webp`;
          const images = [original, extra];
          if (id === "suede-penny")
            images.push("/products/brown-suede-alternate.jpg");
          if (id === "brown-textured") images.push(coffeeScreenshot);
          const product = {
            ...(await store.product("suede-penny")),
            id,
            image:
              id === ownerId ? "/products/owner-replacement.webp" : original,
            images,
            imagePosition: "50% 70%",
            price: 394500,
            stock: 9,
            stockBySize: { 7: 2, 8: 1, 9: 3, 10: 2, 11: 1 },
            description: "Keep the owner's description",
            featured: false,
          };
          before.push(product);
          expected.set(
            id,
            id === ownerId
              ? images
              : [
                  replacement,
                  original,
                  extra,
                  ...(id === "suede-penny"
                    ? ["/products/taupe-gallery-clean-v1.webp"]
                    : []),
                ],
          );
          await store.saveProduct(product);
        }
        const midnight = {
          ...(await store.product("midnight-penny")),
          images: [
            "/products/midnight-cover-studio-v1.webp",
            "/products/dark-suede-alternate.jpg",
            "/products/midnight-detail-owner.webp",
          ],
        };
        before.push(midnight);
        expected.set(midnight.id, [
          midnight.images[0],
          "/products/midnight-gallery-clean-v1.webp",
          midnight.images[2],
        ]);
        await store.saveProduct(midnight);
        await store.db
          .prepare("DELETE FROM migrations WHERE id=?")
          .run(photoCompletionRevision);
      });
      store = await db.open();
      for (const old of before) {
        const cover = completedCovers.find(([id]) => id === old.id);
        assert.deepEqual(await store.product(old.id), {
          ...old,
          ...(cover && old.id !== ownerId
            ? { image: cover[2], imagePosition: "50% 50%" }
            : {}),
          images: expected.get(old.id),
        });
      }
      const future = {
        ...(await store.product("brown-textured")),
        image: "/products/new-owner-coffee.webp",
        images: ["/products/new-owner-coffee.webp"],
      };
      await write(store, () => store.saveProduct(future));
      store = await db.open();
      assert.deepEqual(await store.product(future.id), future);
      for (const [id, original, replacement] of cleanedGalleryPhotos) {
        const p = await store.product(id);
        assert.ok(p.images.includes(replacement));
        assert.ok(!p.images.includes(original));
      }
    } finally {
      await db.close();
    }
  });
}
