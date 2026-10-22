// Owner instruction: 20 available pairs per style, allocated across its sizes.
// The revision prevents redeploys from refilling inventory after sales or edits.
export const ownerStockRevision = "owner-stock-20-per-style-2026-10-21";
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
