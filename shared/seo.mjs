import { optimizedImage } from "./catalogue.mjs";

export const siteOrigin = "https://www.qadamflex.bond";
const pages = {
  "/": [
    "Qadam Flex | Men’s Loafers, Sneakers & Formal Shoes in Pakistan",
    "Shop Qadam Flex men’s loafers, sneakers and formal shoes in Pakistan. Explore product photographs, sizes and prices in PKR.",
  ],
  "/shop": [
    "Shop Men’s Shoes — Qadam Flex Pakistan",
    "Explore Qadam Flex loafers, sneakers and formal shoes. Filter by style, color and size, and check availability before ordering.",
  ],
  "/about": [
    "About Qadam Flex",
    "Meet Qadam Flex and explore our collection of men’s loafers, sneakers and formal shoes.",
  ],
  "/contact": [
    "Contact Qadam Flex",
    "Ask Qadam Flex about product sizing, availability, delivery or an existing order.",
  ],
  "/shipping": [
    "Delivery & Exchanges — Qadam Flex",
    "Check Qadam Flex delivery information, exchange terms and guidance before placing an order.",
  ],
  "/faq": [
    "Shoe Shopping Questions — Qadam Flex",
    "Find answers about Qadam Flex shoe sizes, availability, order enquiries and payments.",
  ],
  "/payments": [
    "Bank Transfer & Easypaisa — Qadam Flex",
    "Learn how confirmed Qadam Flex orders are paid by bank transfer or Easypaisa and how payment receipts are reviewed.",
  ],
  "/privacy": [
    "Privacy Information — Qadam Flex",
    "How Qadam Flex uses account, order, enquiry and payment receipt information.",
  ],
  "/terms": [
    "Store Terms — Qadam Flex",
    "Read the terms for shopping, enquiries and confirmed orders at Qadam Flex.",
  ],
};
const privatePages = ["admin", "account", "cart", "checkout", "confirmation"];
export function absoluteImage(url) {
  const value = optimizedImage(url);
  try {
    const parsed = new URL(value, siteOrigin);
    return parsed.protocol === "https:"
      ? parsed.href
      : `${siteOrigin}/products/hero-textured.webp`;
  } catch {
    return `${siteOrigin}/products/hero-textured.webp`;
  }
}
export function pageMetadata(pathname, products = []) {
  let path;
  try {
    path =
      decodeURIComponent(pathname.split("?")[0]).replace(/\/+$/, "") || "/";
  } catch {
    path = "/not-found";
  }
  const defaults = {
    canonical: `${siteOrigin}${path === "/" ? "/" : path}`,
    image: absoluteImage("/brand/share-logo-v2.jpg"),
    robots: "index, follow, max-image-preview:large",
    status: 200,
    type: "website",
    structuredData: null,
  };
  if (
    privatePages.some(
      (name) => path === `/${name}` || path.startsWith(`/${name}/`),
    )
  )
    return {
      ...defaults,
      title: "Your Qadam Flex workspace",
      description: "Private account and store management.",
      robots: "noindex, nofollow",
    };
  const product = products.find(
    (item) => item.published !== false && path === `/product/${item.slug}`,
  );
  if (product) {
    const description = (
      product.description ||
      product.subtitle ||
      `Explore ${product.name} at Qadam Flex.`
    ).slice(0, 180);
    const offers =
      product.price == null
        ? undefined
        : {
            "@type": "Offer",
            url: defaults.canonical,
            priceCurrency: "PKR",
            price: (product.price / 100).toFixed(2),
          };
    const quantities = product.sizes.map((size) => product.stockBySize?.[size]);
    if (
      offers &&
      quantities.some((count) => typeof count === "number" && count > 0)
    )
      offers.availability = "https://schema.org/InStock";
    else if (
      offers &&
      quantities.length &&
      quantities.every((count) => count === 0)
    )
      offers.availability = "https://schema.org/OutOfStock";
    return {
      ...defaults,
      title: `${product.name} — Qadam Flex Pakistan`,
      description,
      image: absoluteImage(product.image),
      type: "product",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description,
        image: product.images.slice(0, 6).map(absoluteImage),
        sku: product.sku || product.id,
        color: product.color,
        brand: { "@type": "Brand", name: "Qadam Flex" },
        ...(offers ? { offers } : {}),
      },
    };
  }
  if (pages[path])
    return { ...defaults, title: pages[path][0], description: pages[path][1] };
  return {
    ...defaults,
    title: "Page not found — Qadam Flex",
    description:
      "This page is unavailable. Explore the Qadam Flex collection instead.",
    robots: "noindex, nofollow",
    status: 404,
  };
}
export const publicPagePaths = Object.keys(pages);
