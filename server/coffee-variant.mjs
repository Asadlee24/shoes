import { initialProducts } from "./catalog.mjs";
export const revision = "owner-textured-bit-coffee-2026-10-22";
export function updateCoffee(existing) {
 if(!existing)return null;
 const template=initialProducts.find(p=>p.id==="brown-textured");
 if(!template)throw new Error("Coffee variant definition missing");
 return {...existing,name:template.name,subtitle:template.subtitle,slug:template.slug,color:template.color,swatch:template.swatch,variantOf:"textured-bit",published:true,featured:false,image:template.image,images:[...template.images],imagePosition:template.imagePosition,description:template.description,details:[...template.details]};
}
export function sqliteCoffee(db) {
 if(db.prepare("SELECT id FROM migrations WHERE id=?").get(revision))return;
 const row=db.prepare("SELECT data FROM products WHERE id=?").get("brown-textured");
 if(row)db.prepare("UPDATE products SET data=? WHERE id=?").run(JSON.stringify(updateCoffee(JSON.parse(row.data))),"brown-textured");
 db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(revision,new Date().toISOString());
}
export async function postgresCoffee(store) {
 if(await store.db.prepare("SELECT id FROM migrations WHERE id=?").get(revision))return;
 const old=await store.product("brown-textured");
 if(old)await store.saveProduct(updateCoffee(old));
 await store.db.prepare("INSERT INTO migrations(id,applied) VALUES(?,?)").run(revision,new Date().toISOString());
}
