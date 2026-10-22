import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availablePaymentMethods,
  catalogueStyles,
  catalogueColors,
  missingStockSizes,
  paymentRecipient,
} from "../shared/catalogue.mjs";
import { ownerStock } from "../server/inventory.mjs";

const black = {
  id: "black",
  slug: "black-loafer",
  name: "The Bit",
  subtitle: "Black shoe",
  description: "Textured loafer",
  category: "Loafers",
  color: "Black",
  price: 220000,
  published: true,
  sizes: ["7", "8"],
  stockBySize: { 7: 0, 8: 3 },
  image: "/products/black.webp",
  images: [],
};
const coffee = {
  ...black,
  id: "coffee",
  variantOf: "black",
  slug: "coffee-loafer",
  name: "The Bit — Coffee",
  color: "Coffee Brown",
  stockBySize: { 7: 4, 8: null },
  image: "/products/coffee.webp",
};

test("color and search results show the matching variant with its own cover and product URL", () => {
  const [result] = catalogueStyles([black, coffee], { color: "coffee brown" });
  assert.equal(result.id, "coffee");
  assert.equal(result.image, "/products/coffee.webp");
  assert.equal(result.slug, "coffee-loafer");
  assert.deepEqual(
    catalogueStyles([black, coffee], { q: "coffee" }).map(
      (product) => product.id,
    ),
    ["coffee"],
  );
  assert.equal(catalogueStyles([black, coffee]).length, 1);
});
test("color choices merge case duplicates and size filters exclude sold-out selections", () => {
  assert.deepEqual(
    catalogueColors([
      black,
      { ...black, id: "lowercase", color: "black" },
      coffee,
    ]),
    ["Black", "Coffee Brown"],
  );
  assert.deepEqual(
    catalogueStyles([black, coffee], { color: "BLACK", size: "7" }),
    [],
  );
  assert.equal(catalogueStyles([black, coffee], { size: "7" })[0].id, "coffee");
});
test("published variants remain discoverable when a parent is unpublished", () => {
  assert.equal(
    catalogueStyles([{ ...black, published: false }, coffee])[0].id,
    "coffee",
  );
});
test("unknown quantities remain unknown and old stock instructions never fill a new style", () => {
  const product = {
    ...coffee,
    id: "owner-new-style",
    stock: null,
    stockBySize: { 7: null, 8: null },
  };
  assert.deepEqual(missingStockSizes(product), ["7", "8"]);
  assert.equal(ownerStock(product), product);
  assert.deepEqual(product.stockBySize, { 7: null, 8: null });
});
test("enquiries never expose a payment recipient, even if old data contains bank details", () => {
  const recipient = {
    holder: "Test recipient",
    iban: "test-iban",
    account: "12345678",
  };
  assert.equal(
    paymentRecipient({ method: "bank", status: "not_required", recipient }),
    null,
  );
  assert.equal(
    paymentRecipient({ method: "bank", status: "awaiting_payment" }),
    null,
  );
  assert.equal(
    paymentRecipient({ method: "bank", status: "awaiting_payment", recipient }),
    recipient,
  );
  assert.equal(
    paymentRecipient({ method: "cod", status: "cod", recipient }),
    null,
  );
});

test("checkout offers only methods configured by the owner", () => {
  assert.deepEqual(availablePaymentMethods({ codEnabled: false }), []);
  assert.deepEqual(
    availablePaymentMethods({
      easypaisaHolder: "Fixture recipient",
      easypaisaNumber: "03001234567",
      codEnabled: false,
    }),
    ["easypaisa"],
  );
  assert.deepEqual(
    availablePaymentMethods({
      bankAccountHolder: "Fixture recipient",
      bankIban: "fixture-iban",
      codEnabled: true,
    }),
    ["bank", "cod"],
  );
});
