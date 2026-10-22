// Roll back only the six shoe photographs mistakenly associated with existing
// Qadam Flex listings on 22 Oct 2026. Do not alter other products or pricing.
export const mistakenPhotos = {
  "textured-bit": [
    "/products/texture-pair-qf-2026.jpg",
    "/products/texture-alt-qf-2026.jpg",
    "/products/texture-angle-qf-2026.jpg",
  ],
  "evening-bit": [
    "/products/formal-pair-qf-2026.jpg",
    "/products/formal-angle-qf-2026.jpg",
    "/products/formal-side-qf-2026.jpg",
  ],
};
export const rollbackRevision = "owner-gallery-rollback-2026-10-22";

export function withoutMistakenPhotos(product) {
  if (!product || !Object.hasOwn(mistakenPhotos, product.id)) return product;
  const removed = new Set(mistakenPhotos[product.id]);
  const previous = Array.isArray(product.images) ? product.images : [];
  const images = previous.filter((url) => !removed.has(url));
  const image = removed.has(product.image) ? (images[0] || "") : product.image;
  if (images.length === previous.length && image === product.image) return product;
  return { ...product, image, images };
}

// SQLite initialization already runs in its own write transaction.
export function rollbackMistakenPhotosSqlite(db) {
  if (db.prepare("SELECT id FROM migrations WHERE id=?").get(rollbackRevision)) return;
  for (const id of Object.keys(mistakenPhotos)) {
    const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
    if (!row) continue;
    const before = JSON.parse(row.data);
    const after = withoutMistakenPhotos(before);
    if (after !== before) {
      db.prepare("UPDATE products SET data=? WHERE id=?")
        .run(JSON.stringify(after), id);
    }
  }
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(rollbackRevision, new Date().toISOString());
}

// Neon/Postgres boot migration uses the existing transaction-safe store adapter.
export async function rollbackMistakenPhotosStore(store) {
  if (await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(rollbackRevision)) return;
  for (const id of Object.keys(mistakenPhotos)) {
    const before = await store.product(id);
    const after = withoutMistakenPhotos(before);
    if (after !== before) await store.saveProduct(after);
  }
  await store.db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(rollbackRevision, new Date().toISOString());
}
