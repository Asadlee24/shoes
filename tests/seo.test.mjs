import { test } from "node:test";
import assert from "node:assert/strict";
import { pageMetadata } from "../shared/seo.mjs";
import { renderPage, renderSitemap } from "../server/seo.mjs";
const product = {
  id: "test-shoe",
  slug: "test-shoe",
  name: 'Test <shoe> "pair"',
  subtitle: "Shoe",
  description: "Owner description",
  published: true,
  image: "/products/hero-textured.png",
  images: ["/products/hero-textured.png"],
  sizes: ["7"],
  stockBySize: { 7: null },
  price: 314500,
  color: "Black",
};
test("product metadata uses its own canonical, image and accurate price without claiming unknown stock", () => {
  const meta = pageMetadata("/product/test-shoe", [product]);
  assert.equal(meta.canonical, "https://www.qadamflex.bond/product/test-shoe");
  assert.match(meta.title, /Test <shoe>/);
  assert.match(meta.image, /hero-textured.webp$/);
  assert.equal(meta.structuredData.offers.price, "3145.00");
  assert.equal("availability" in meta.structuredData.offers, false);
  assert.equal(
    pageMetadata("/product/test-shoe", [{ ...product, stockBySize: { 7: 0 } }])
      .structuredData.offers.availability,
    "https://schema.org/OutOfStock",
  );
});
test("server-rendered metadata replaces inherited homepage tags and escapes HTML and JSON-LD", () => {
  const template =
    '<html><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="https://www.qadamflex.bond/"><meta property="og:title" content="Old"></head><body></body></html>';
  const meta = pageMetadata("/product/test-shoe", [
    { ...product, description: '</script><img src=x onerror="bad()">' },
  ]);
  const html = renderPage(template, meta);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.match(html, /Test &lt;shoe&gt; &quot;pair&quot;/);
  assert.equal(html.includes("<img src=x"), false);
  const json = html.match(/type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.equal(
    JSON.parse(json).description,
    '</script><img src=x onerror="bad()">',
  );
  assert.equal(json.includes("</script>"), false);
});
test("private, missing and unpublished routes are noindex and unpublished products stay out of sitemap", () => {
  assert.match(pageMetadata("/admin/demo", [product]).robots, /noindex/);
  assert.equal(
    pageMetadata("/product/test-shoe", [{ ...product, published: false }])
      .status,
    404,
  );
  assert.match(pageMetadata("/missing", []).robots, /noindex/);
  const sitemap = renderSitemap([
    product,
    { ...product, id: "hidden", slug: "hidden", published: false },
  ]);
  assert.match(sitemap, /\/product\/test-shoe/);
  assert.equal(sitemap.includes("/product/hidden"), false);
});
