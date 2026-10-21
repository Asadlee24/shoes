import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import {
  galleryRefreshes,
  refreshCatalogGalleries,
} from "../server/catalog-gallery-refresh.mjs";

test("gallery refresh replaces every known blurry angle, deduplicates covers and preserves owner data", async (t) => {
  const store = openStore(":memory:");
  t.after(() => store.db.close());
  for (const [id, replacements] of galleryRefreshes) {
    const [originalCover, cover] = replacements[0];
    const product = {
      ...store.product("suede-penny"),
      id,
      image: cover,
      images: [
        cover,
        ...replacements.map(([url]) => url),
        "/products/owner-detail.jpg",
      ],
      price: 353100,
      stock: 19,
      featured: true,
    };
    store.saveProduct(product);
    assert.ok(product.images.includes(originalCover));
  }
  await refreshCatalogGalleries(store);
  for (const [id, replacements] of galleryRefreshes) {
    const result = store.product(id);
    assert.deepEqual(result.images, [
      ...new Set(replacements.map(([, url]) => url)),
      "/products/owner-detail.jpg",
    ]);
    assert.equal(result.price, 353100);
    assert.equal(result.stock, 19);
    assert.equal(result.image, replacements[0][1]);
    assert.equal(result.featured, true);
    result.images = ["/products/new-owner-detail.jpg"];
    store.saveProduct(result);
  }
  await refreshCatalogGalleries(store);
  for (const [id] of galleryRefreshes)
    assert.deepEqual(store.product(id).images, [
      "/products/new-owner-detail.jpg",
    ]);
});
