import type { Product, Payment, Settings } from "../src/types";
export function availablePaymentMethods(
  settings?: Partial<Settings> | null,
): ("bank" | "easypaisa" | "cod")[];
export function normalizeColor(value?: string): string;
export function displayColor(value?: string): string;
export function catalogueStyles(
  products: Product[],
  filters?: {
    q?: string;
    color?: string;
    category?: string;
    size?: string;
    sort?: string;
  },
): Product[];
export function catalogueColors(products: Product[]): string[];
export function missingStockSizes(product: Product): string[];
export function productSetupIssues(product: Product): string[];
export function availabilityText(product: Product, size?: string): string;
export function paymentRecipient(
  payment?: Payment,
): Payment["recipient"] | null;
export function optimizedImage(url?: string): string;
