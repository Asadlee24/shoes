import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutMistakenPhotos, mistakenPhotos } from "../server/owner-gallery-rollback.mjs";

test("remove only the six mistaken photos, preserving stock, price and original images", () => {
  for (const [id, removed] of Object.entries(mistakenPhotos)) {
    const original = "/products/original-shoe.jpg";
    const product = { id, image: original, price: 315000, stock: 18,
      images: [original, ...removed, "/products/owner-upload.jpg"] };
    const cleaned = withoutMistakenPhotos(product);
    assert.deepEqual(cleaned.images, [original, "/products/owner-upload.jpg"]);
    assert.equal(cleaned.image, original);
    assert.equal(cleaned.price, product.price);
    assert.equal(cleaned.stock, product.stock);
    assert.strictEqual(withoutMistakenPhotos(cleaned), cleaned);
  }
  const unrelated = { id: "unrelated", images: ["/products/texture-pair-qf-2026.jpg"] };
  assert.strictEqual(withoutMistakenPhotos(unrelated), unrelated);
});

test("restore a cover only if the mistakenly added photograph was selected", () => {
  const product = { id: "evening-bit", image: mistakenPhotos["evening-bit"][0],
    images: [mistakenPhotos["evening-bit"][0], "/products/black-formal.jpg"] };
  const cleaned = withoutMistakenPhotos(product);
  assert.equal(cleaned.image, "/products/black-formal.jpg");
  assert.deepEqual(cleaned.images, ["/products/black-formal.jpg"]);
});
