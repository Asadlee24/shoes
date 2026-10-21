import { waitUntil } from "@vercel/functions";
import { createApplication, passwordHash } from "./index.mjs";
import { openPostgresStore } from "./postgres.mjs";

export function bufferedResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    end(payload) {
      this.payload = payload;
    },
  };
}

export function createCloudHandler(options = {}) {
  let application;
  async function initialize() {
    const store = options.store || (await openPostgresStore());
    const password = process.env.ADMIN_PASSWORD || "";
    const adminHash =
      options.adminHash ||
      process.env.ADMIN_PASSWORD_HASH ||
      (password.length >= 12 && password.length <= 200
        ? passwordHash(password)
        : "");
    const app = await createApplication({
      store,
      apiOnly: true,
      production: true,
      useVite: false,
      trustProxy: true,
      secureCookies: true,
      adminHash,
      emailApiKey: options.emailApiKey,
      emailFrom: options.emailFrom,
      emailSend: options.emailSend,
      setupEmailTest:
        options.setupEmailTest ?? process.env.VERCEL_ENV === "production",
      adminMissingMessage:
        "Set a private ADMIN_PASSWORD (12–200 characters) in Vercel Production environment variables, then redeploy to enable administrator login.",
    });
    return { ...app, adminConfigured: Boolean(adminHash) };
  }
  return async function handle(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Cache-Control", "no-store");
    try {
      const url = new URL(req.url, "https://store.invalid");
      const route = url.searchParams.get("route") || req.query?.route;
      const path = route ? `/api/${String(route)}` : url.pathname;
      if (!application)
        application = initialize().catch((error) => {
          application = undefined;
          throw error;
        });
      const app = await application;
      const buffered = bufferedResponse();
      await app.store.withRequest(
        !["GET", "HEAD"].includes(req.method),
        async () => {
          if (path === "/api/health" && req.method === "GET") {
            buffered.writeHead(200, { "Content-Type": "application/json" });
            buffered.end(
              JSON.stringify({
                database: "connected",
                adminConfigured: app.adminConfigured,
              }),
            );
          } else if (
            path.startsWith("/api/media/") &&
            ["GET", "HEAD"].includes(req.method)
          ) {
            const name = path.slice("/api/media/".length);
            const media = /^upload-[\da-f-]+\.(jpg|png|webp)$/.test(name)
              ? await app.store.media(name)
              : null;
            if (!media) {
              buffered.writeHead(404, { "Content-Type": "text/plain" });
              buffered.end("Image not found");
            } else {
              buffered.writeHead(200, {
                "Content-Type": media.type,
                "Cache-Control": "public, max-age=31536000, immutable",
              });
              buffered.end(
                req.method === "HEAD" ? undefined : Buffer.from(media.data),
              );
            }
          } else await app.handleApi(req, buffered, path);
        },
      );
      // Do not send success or a session cookie until the transaction commits.
      const delivery = app.notifications
        .flush(12)
        .catch(() => console.error("Email queue processing failed."));
      // Reset requests return the same response without waiting on the mail
      // provider. Vercel keeps durable outbox work alive after the response.
      if (process.env.VERCEL || options.background)
        (options.background || waitUntil)(delivery);
      else await delivery;
      res.writeHead(buffered.statusCode, buffered.headers);
      res.end(buffered.payload);
    } catch (error) {
      // Never send database URLs, SQL driver messages or credentials to clients.
      res.writeHead(error.status || 503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error: error.status
            ? error.message
            : "The store database could not be reached. Please try again shortly.",
        }),
      );
    }
  };
}

export const cloudHandler = createCloudHandler();
