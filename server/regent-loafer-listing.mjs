import { initialProducts } from "./catalog.mjs";
export const regentSeedRevision = "owner-regent-bit-loafer-2026-10-22";
export const regentProductId = "regent-bit-black-2026";
export function regentProduct() {
  const product = initialProducts.find(p => p.id === regentProductId);
  if (!product) throw new Error("Missing Regent loafer product");
  return product;
}
export function seedRegentSqlite(db) {
  if (db.prepare("SELECT id FROM migrations WHERE id=?").get(regentSeedRevision)) return;
  const product = regentProduct();
  db.prepare("INSERT INTO products VALUES(?,?) ON CONFLICT(id) DO NOTHING").run(product.id,JSON.stringify(product));
  db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(regentSeedRevision,new Date().toISOString());
}
export async function seedRegentPostgres(store) {
  if (await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(regentSeedRevision)) return;
  const product = regentProduct();
  if (!(await store.product(product.id))) await store.saveProduct(product);
  await store.db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(regentSeedRevision,new Date().toISOString());
}
