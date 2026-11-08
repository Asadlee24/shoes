// Owner instruction: 20 available pairs per style, allocated across its sizes.
// The revision prevents redeploys from refilling inventory after sales or edits.
export const ownerStockRevision = "owner-stock-20-per-style-2026-10-21";
export const novemberStockConfirmation = "owner-stock-10-per-style-2026-11-08";
export const novemberStockIds = [
  "chelsea-black",
  "chelsea-brown",
  "olive-gum-penny",
];

export function confirmNovemberStock(product) {
  if (product?.stock != null || !product?.sizes?.length) return product;
  const sizes = [...new Set(product.sizes.map(String))];
  if (sizes.some((size) => product.stockBySize?.[size] != null)) return product;
  const stock = 10;
  return {
    ...product,
    stock,
    stockBySize: Object.fromEntries(
      sizes.map((size, index) => [
        size,
        Math.floor(stock / sizes.length) +
          (index < stock % sizes.length ? 1 : 0),
      ]),
    ),
  };
}

export function ownerStock(product) {
  // That instruction covered these existing styles. New catalogue entries and
  // later owner uploads must keep their actual, independently confirmed stock.
  if (
    ![
      "suede-penny",
      "textured-bit",
      "evening-bit",
      "midnight-penny",
      "brown-textured",
    ].includes(product.id)
  )
    return product;
  if (!Array.isArray(product.sizes) || !product.sizes.length) return product;
  const sizes = [...new Set(product.sizes.map(String))];
  return {
    ...product,
    stock: 20,
    stockBySize: Object.fromEntries(
      sizes.map((size, index) => [
        size,
        Math.floor(20 / sizes.length) + (index < 20 % sizes.length ? 1 : 0),
      ]),
    ),
  };
}
