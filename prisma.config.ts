import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` (run on install) doesn't connect to the database, so it
    // must not require DATABASE_URL: CI, Docker and Vercel installs may not have
    // it. Commands that do connect (migrate, studio) fail clearly if it's missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
