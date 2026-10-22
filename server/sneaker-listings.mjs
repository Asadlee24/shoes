// Add the two new sneakers to stores with an existing product database.
// Only insert absent IDs: preserve all owner edits to products and orders.
import { initialProducts } from "./catalog.mjs";

export const sneakerListingRevision = "owner-metro-court-sneakers-2026-10-22";
export const sneakerProductIds = ["metro-court-mocha", "metro-court-onyx"];

export function sneakerSeedProducts() {
  return sneakerProductIds.map((id) => {
    const product = initialProducts.find((item) => item.id === id);
    if (!product) throw new Error(`Missing sneaker listing: ${id}`);
    return {
      ...product,
      stock: null,
      stockBySize: Object.fromEntries(product.sizes.map((size) => [size, null])),
    };
  });
}

export function seedSneakersSqlite(db) {
  if (db.prepare("SELECT id FROM migrations WHERE id=?").get(sneakerListingRevision)) return;
  const insert = db.prepare("INSERT INTO products VALUES(?,?) ON CONFLICT(id) DO NOTHING");
  for (const product of sneakerSeedProducts())
    insert.run(product.id, JSON.stringify(product));
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(sneakerListingRevision, new Date().toISOString());
}

export async function seedSneakersPostgres(store) {
  if (await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(sneakerListingRevision)) return;
  for (const product of sneakerSeedProducts()) {
    if (!(await store.product(product.id))) await store.saveProduct(product);
  }
  await store.db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(sneakerListingRevision, new Date().toISOString());
}
