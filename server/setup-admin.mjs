import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { resolve } from "node:path";
const path = resolve(".env");
let env = existsSync(path) ? readFileSync(path, "utf8") : "";
if (/^ADMIN_PASSWORD_HASH=/m.test(env) && !process.argv.includes("--reset")) {
  console.log(
    "Administrator already configured. Use npm run admin:setup -- --reset to replace the password.",
  );
  process.exit(0);
}
const password = randomBytes(15).toString("base64url");
const salt = randomBytes(16).toString("hex");
const digest = scryptSync(password, salt, 64).toString("hex");
env = env
  .replace(/^ADMIN_PASSWORD_HASH=.*\n?/gm, "")
  .replace(/^ADMIN_USER=.*\n?/gm, "");
writeFileSync(
  path,
  `${env.trim()}\nADMIN_USER=admin\nADMIN_PASSWORD_HASH=${salt}:${digest}\n`,
  { mode: 0o600 },
);
console.log(
  `Local administrator configured.\nUsername: admin\nPassword: ${password}\nRestart the server after changing credentials. Keep this password private.`,
);
