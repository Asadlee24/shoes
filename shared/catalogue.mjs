export const normalizeColor = (value = "") =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
export const displayColor = (value = "") =>
  value.trim().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function catalogueStyles(products, filters = {}) {
  const published = products.filter((product) => product.published !== false);
  const q = (filters.q || "").trim().toLowerCase();
  const color = normalizeColor(filters.color);
  const roots = published.filter(
    (product) =>
      !product.variantOf ||
      !published.some((parent) => parent.id === product.variantOf),
  );
  const selected = [];
  for (const root of roots) {
    const family = [
      root,
      ...published.filter((product) => product.variantOf === root.id),
    ];
    let candidates = family.filter(
      (product) =>
        (!color || normalizeColor(product.color) === color) &&
        (!filters.category || product.category === filters.category) &&
        (!filters.size ||
          (product.sizes.includes(filters.size) &&
            product.stockBySize?.[filters.size] !== 0)),
    );
    if (q)
      candidates = candidates.filter((product) =>
        `${product.name} ${product.subtitle} ${product.description} ${product.color}`
          .toLowerCase()
          .includes(q),
      );
    if (candidates.length) selected.push(candidates[0]);
  }
  return selected.sort((a, b) =>
    filters.sort === "name"
      ? a.name.localeCompare(b.name)
      : filters.sort === "low"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : filters.sort === "high"
          ? (b.price ?? -1) - (a.price ?? -1)
          : 0,
  );
}

export function catalogueColors(products) {
  return [
    ...new Map(
      products
        .filter((product) => product.published !== false)
        .map((product) => [
          normalizeColor(product.color),
          displayColor(product.color),
        ]),
    ).values(),
  ];
}

export function missingStockSizes(product) {
  return product.sizes.filter((size) => product.stockBySize?.[size] == null);
}

export function productSetupIssues(product) {
  return [
    ...(product.price == null ? ["Set a price"] : []),
    ...(!product.image && !product.images?.length ? ["Add a cover photo"] : []),
    ...(!product.sizes.length ? ["Select sizes"] : []),
    ...(missingStockSizes(product).length
      ? [`Confirm stock for sizes ${missingStockSizes(product).join(", ")}`]
      : []),
  ];
}

export function availabilityText(product, size = "") {
  if (size && product.stockBySize?.[size] === 0)
    return `Size ${size} is currently sold out.`;
  if (product.price == null)
    return "Price and availability confirmed on enquiry. No payment is required.";
  const missing = missingStockSizes(product);
  if (size && missing.includes(size))
    return `Availability for size ${size} needs confirmation. Send an enquiry; do not pay yet.`;
  if (missing.length === product.sizes.length)
    return "Availability on request. Send an enquiry; do not pay yet.";
  if (missing.length && !size) return "Choose a size to check availability.";
  if (product.sizes.every((value) => product.stockBySize?.[value] === 0))
    return "Currently sold out.";
  return "";
}

export function paymentRecipient(payment) {
  if (
    !payment ||
    payment.status === "not_required" ||
    !["bank", "easypaisa"].includes(payment.method)
  )
    return null;
  const recipient = payment.recipient;
  if (
    !recipient?.holder ||
    (payment.method === "bank" ? !recipient.iban : !recipient.number)
  )
    return null;
  return recipient;
}

export function availablePaymentMethods(settings) {
  return [
    ...(settings?.bankAccountHolder && settings?.bankIban ? ["bank"] : []),
    ...(settings?.easypaisaHolder && settings?.easypaisaNumber
      ? ["easypaisa"]
      : []),
    ...(settings?.codEnabled ? ["cod"] : []),
  ];
}

const optimizedPhotos = {
  "/products/hero-textured.png": "/products/hero-textured.webp",
  "/products/hero-loafer.png": "/products/hero-loafer.webp",
};
export const optimizedImage = (url = "") => optimizedPhotos[url] || url;
