// Only refresh the five owner-requested covers from their exact original URLs.
// Later administrator uploads, gallery angles and commercial data stay intact.
export const studioCoverRevision = "owner-single-shoe-covers-2026-10-22-v1";
export const studioCoverRefreshes = [
  [
    "evening-bit",
    "/products/black-formal.jpg",
    "/products/evening-cover-studio-v1.webp",
  ],
  [
    "midnight-penny",
    "/products/dark-suede.jpg",
    "/products/midnight-cover-studio-v1.webp",
  ],
  [
    "metro-court-mocha",
    "/products/qf-mocha-1.webp",
    "/products/mocha-cover-studio-v1.webp",
  ],
  [
    "metro-court-onyx",
    "/products/qf-onyx-1.webp",
    "/products/onyx-cover-studio-v1.webp",
  ],
  [
    "regent-bit-black-2026",
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3Is9kobfnwtcyCgM78744SOnddo/c9fe1009-d647-489a-ad35-9ade717fc6e7.jpg",
    "/products/regent-cover-studio-v1.webp",
  ],
];

export function refreshedStudioCover(product) {
  if (!product) return product;
  const match = studioCoverRefreshes.find(
    ([id, original]) => product.id === id && product.image === original,
  );
  if (!match) return product;
  const [, original, replacement] = match;
  return {
    ...product,
    image: replacement,
    imagePosition: "50% 50%",
    images: [...new Set([replacement, original, ...(product.images || [])])],
  };
}

// Both adapters call these inside their existing startup write transaction,
// after sneaker and Regent listing migrations have inserted any missing products.
export function refreshStudioCoversSqlite(db) {
  if (
    db.prepare("SELECT id FROM migrations WHERE id=?").get(studioCoverRevision)
  )
    return;
  for (const [id] of studioCoverRefreshes) {
    const row = db.prepare("SELECT data FROM products WHERE id=?").get(id);
    if (!row) continue;
    const before = JSON.parse(row.data);
    const after = refreshedStudioCover(before);
    if (after !== before)
      db.prepare("UPDATE products SET data=? WHERE id=?").run(
        JSON.stringify(after),
        id,
      );
  }
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(
    studioCoverRevision,
    new Date().toISOString(),
  );
}

export async function refreshStudioCoversPostgres(store) {
  if (
    await store.db
      .prepare("SELECT id FROM migrations WHERE id=?")
      .get(studioCoverRevision)
  )
    return;
  for (const [id] of studioCoverRefreshes) {
    const before = await store.product(id);
    const after = refreshedStudioCover(before);
    if (after !== before) await store.saveProduct(after);
  }
  await store.db
    .prepare("INSERT INTO migrations(id,applied) VALUES(?,?)")
    .run(studioCoverRevision, new Date().toISOString());
}
