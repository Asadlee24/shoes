import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore } from "../server/store.mjs";
import {
  coverRefreshes,
  refreshCatalogCovers,
} from "../server/catalog-photo-refresh.mjs";

test("cover refresh preserves prices, inventory, original angles and future owner edits", async (t) => {
  const store = openStore(":memory:");
  t.after(() => store.db.close());
  const [id, original, replacement] = coverRefreshes[0];
  const product = {
    ...store.product("suede-penny"),
    id,
    image: original,
    images: [original, "/products/detail.png"],
    price: 353100,
    stock: 19,
    featured: true,
  };
  store.saveProduct(product);
  const [otherId] = coverRefreshes[1];
  const ownerEdit = {
    ...product,
    id: otherId,
    image: "/products/new-owner-cover.png",
  };
  store.saveProduct(ownerEdit);
  await refreshCatalogCovers(store);
  const result = store.product(id);
  assert.deepEqual(result, {
    ...product,
    image: replacement,
    imagePosition: "50% 50%",
    images: [replacement, original, "/products/detail.png"],
  });
  assert.deepEqual(store.product(otherId), ownerEdit);
  result.image = "/products/later-cover.png";
  store.saveProduct(result);
  await refreshCatalogCovers(store);
  assert.deepEqual(store.product(id), result);
});
