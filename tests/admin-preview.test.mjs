import { test } from "node:test";
import assert from "node:assert/strict";
import { previewDashboard } from "../src/admin-preview.ts";
import { initialProducts, initialSettings } from "../server/catalog.mjs";

test("admin preview uses public products and contains no customer records or discounts", () => {
  const catalog = {
    products: structuredClone(initialProducts),
    settings: {
      ...structuredClone(initialSettings),
      discounts: [{ code: "PRIVATE" }],
    },
    requests: [{ data: { customer: { name: "Private customer" } } }],
  };
  const preview = previewDashboard(catalog);
  assert.ok(preview.products.every((p) => p.published));
  assert.deepEqual(preview.requests, []);
  assert.deepEqual(preview.settings.discounts, []);
  preview.products[0].price = 1;
  preview.settings.phone = "changed";
  assert.notEqual(catalog.products[0].price, 1);
  assert.notEqual(catalog.settings.phone, "changed");
});
