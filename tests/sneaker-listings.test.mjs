import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initialProducts } from "../server/catalog.mjs";
import { seedSneakersSqlite, sneakerProductIds } from "../server/sneaker-listings.mjs";
import { ownerStock } from "../server/inventory.mjs";

test("new brown and black sneaker listings have exactly four correct images and Rs. 3,000 prices", () => {
  const products = sneakerProductIds.map((id) => initialProducts.find((p) => p.id === id));
  assert.equal(products.length, 2);
  assert.equal(new Set(products.map((p) => p.slug)).size, 2);
  for (const p of products) {
    assert.ok(p);
    assert.equal(p.price, 300000);
    assert.equal(p.category, "Sneakers");
    assert.equal(p.published, true);
    assert.equal(p.stock, null);
    assert.equal(ownerStock(p).stock, null);
    assert.equal(p.images.length, 4);
    assert.equal(p.image, p.images[0]);
    const color = p.id === "metro-court-mocha" ? "mocha" : "onyx";
    assert.ok(p.images.every((img) => img.startsWith(`/products/qf-${color}-`) && img.endsWith(".webp")));
  }
});

test("existing database adds new sneakers once, without overwriting owner edits", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE products(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE migrations(id TEXT PRIMARY KEY, applied TEXT NOT NULL)");
    seedSneakersSqlite(db);
    assert.equal(db.prepare("SELECT count(*) AS total FROM products").get().total, 2);
    let product = JSON.parse(db.prepare("SELECT data FROM products WHERE id=?").get("metro-court-mocha").data);
    assert.equal(product.stockBySize["7"], null);
    product.price = 290000;
    product.stockBySize["7"] = 2;
    db.prepare("UPDATE products SET data=? WHERE id=?").run(JSON.stringify(product), product.id);
    seedSneakersSqlite(db);
    const again = JSON.parse(db.prepare("SELECT data FROM products WHERE id=?").get(product.id).data);
    assert.equal(again.price, 290000);
    assert.equal(again.stockBySize["7"], 2);
    assert.equal(db.prepare("SELECT count(*) AS total FROM products").get().total, 2);
  } finally { db.close(); }
});
