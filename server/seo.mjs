import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pageMetadata, publicPagePaths, siteOrigin } from "../shared/seo.mjs";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
let template;
async function readTemplate() {
  template ||= readFile(new URL("../dist/index.html", import.meta.url), "utf8")
    .catch(() => readFile(join(process.cwd(), "dist/index.html"), "utf8"))
    .catch((error) => {
      template = undefined;
      throw error;
    });
  return template;
}
export function renderPage(template, metadata) {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(
      /<meta\b[^>]*(?:name=["'](?:description|robots|twitter:card)["']|property=["']og:[^"']+["'])[^>]*>/gi,
      "",
    )
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(
      /<script\b[^>]*id=["']qf-product-schema["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
  const tags = [
    `<title>${escape(metadata.title)}</title>`,
    `<meta name="description" content="${escape(metadata.description)}">`,
    `<meta name="robots" content="${escape(metadata.robots)}">`,
    `<link rel="canonical" href="${escape(metadata.canonical)}">`,
    ...Object.entries({
      type: metadata.type,
      site_name: "Qadam Flex",
      title: metadata.title,
      description: metadata.description,
      url: metadata.canonical,
      image: metadata.image,
    }).map(
      ([name, value]) =>
        `<meta property="og:${name}" content="${escape(value)}">`,
    ),
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  if (metadata.structuredData)
    tags.push(
      `<script id="qf-product-schema" type="application/ld+json">${JSON.stringify(metadata.structuredData).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}</script>`,
    );
  html = html.replace(/<\/head>/i, `${tags.join("\n")}\n</head>`);
  return html;
}
export function renderSitemap(products) {
  const paths = [
    ...publicPagePaths,
    ...products
      .filter((product) => product.published !== false)
      .map((product) => `/product/${product.slug}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(paths)].map((path) => `  <url><loc>${escape(`${siteOrigin}${path}`)}</loc></url>`).join("\n")}\n</urlset>\n`;
}
export async function serveSeo(req, res, store, path, suppliedTemplate) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const products = await store.products();
  const sitemap = path === "/sitemap.xml";
  const metadata = sitemap ? null : pageMetadata(path, products);
  const data = sitemap
    ? renderSitemap(products)
    : renderPage(suppliedTemplate ?? (await readTemplate()), metadata);
  res.writeHead(metadata?.status || 200, {
    "Content-Type": sitemap
      ? "application/xml; charset=utf-8"
      : "text/html; charset=utf-8",
    "Cache-Control": metadata?.robots.startsWith("noindex")
      ? "no-store"
      : "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
    "X-Content-Type-Options": "nosniff",
    ...(metadata?.robots.startsWith("noindex")
      ? { "X-Robots-Tag": "noindex, nofollow" }
      : {}),
  });
  res.end(req.method === "HEAD" ? undefined : data);
}
