import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { regentProduct, seedRegentSqlite } from "../server/regent-loafer-listing.mjs";
test("Regent formal loafer has unique photo gallery and PKR 2500 price",()=>{
 const p=regentProduct();
 assert.equal(p.price,250000);assert.equal(p.images.length,4);assert.equal(new Set(p.images).size,4);
 assert.equal(p.category,"Formal shoes");assert.equal(p.stock,null);
});
test("existing products remain untouched on repeated seed",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec("CREATE TABLE products(id TEXT PRIMARY KEY,data TEXT NOT NULL);CREATE TABLE migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL)");
  db.prepare("INSERT INTO products VALUES(?,?)").run("existing",JSON.stringify({price:123400}));
  seedRegentSqlite(db);seedRegentSqlite(db);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products").get().n,2);
  assert.equal(JSON.parse(db.prepare("SELECT data FROM products WHERE id='existing'").get().data).price,123400);
 }finally{db.close();}
});
