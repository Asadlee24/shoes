import {
  initialProducts,
  initialSettings,
  publicSettings,
} from "../server/catalog.mjs";

// Public catalog only until a persistent database is attached to Vercel.
export default function catalog(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  return res.status(200).json({
    products: initialProducts
      .filter((product) => product.published)
      .map((product) => ({
        ...product,
        stockBySize: Object.fromEntries(
          product.sizes.map((size) => [size, null]),
        ),
      })),
    settings: publicSettings({ ...initialSettings, codEnabled: false }),
  });
}
