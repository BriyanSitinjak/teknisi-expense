import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Migrations prefer the direct Neon URL. `prisma generate` only loads this file
// and does not connect, so a missing direct URL must not fail the Vercel install.
function datasourceUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/placeholder"
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
