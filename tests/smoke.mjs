import { createApplication } from "../server/index.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "qadam-smoke-"));
const app = await createApplication({ dbPath: join(dir, "store.db") });
try {
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  for (const path of [
    "/",
    "/shop",
    "/payments",
    "/contact",
    "/src/Business.tsx",
    "/src/studio-photo.ts",
    "/product/brown-suede-loafer",
    "/admin",
    "/admin/demo",
    "/src/admin-preview.ts",
    "/api/catalog",
    "/src/main.tsx",
    "/src/Home.tsx",
    "/src/Admin.tsx",
    "/src/Showroom.tsx",
    "/src/StudioScene.tsx",
    "/src/studio-motion.ts",
    "/src/theme.tsx",
    "/products/hero-textured.png",
    "/products/hero-loafer.png",
    "/brand/approved-logo.png",
    "/brand/logo-transparent.png",
    "/src/brand.css",
  ]) {
    const response = await fetch(base + path);
    const payload = await response.arrayBuffer();
    if (response.status !== 200) throw new Error(`${path}: ${response.status}`);
    console.log(`PASS ${path} — ${payload.byteLength} bytes`);
  }
} finally {
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
