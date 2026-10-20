import type { Product, Settings, StoreRequest } from "./types";

export function previewDashboard(catalog: {
  products: Product[];
  settings: Settings;
}) {
  return {
    products: catalog.products
      .filter((product) => product.published)
      .map((product) => structuredClone(product)),
    settings: { ...structuredClone(catalog.settings), discounts: [] },
    requests: [] as StoreRequest[],
  };
}
