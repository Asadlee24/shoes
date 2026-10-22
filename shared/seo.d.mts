import type { Product } from "../src/types";
export const siteOrigin: string;
export const publicPagePaths: string[];
export function absoluteImage(url?: string): string;
export type Metadata = {
  title: string;
  description: string;
  canonical: string;
  image: string;
  robots: string;
  status: number;
  type: string;
  structuredData: Record<string, unknown> | null;
};
export function pageMetadata(pathname: string, products?: Product[]): Metadata;
