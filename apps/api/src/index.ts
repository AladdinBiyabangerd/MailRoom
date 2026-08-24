import { config } from "./config.js";
import { prisma } from "./db.js";
import { bootstrapAdmin } from "./bootstrap.js";
import { buildApp } from "./app.js";
import { dispatchDueScheduled } from "./services/emails.js";
import { cleanupExpiredRefreshTokens } from "./services/auth.js";

async function main() {
  await bootstrapAdmin();
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });

  setInterval(() => {
    void dispatchDueScheduled();
  }, 30_000);
  setInterval(() => {
    void cleanupExpiredRefreshTokens();
  }, 3_600_000);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
