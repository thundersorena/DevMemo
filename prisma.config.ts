import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` (run on install) doesn't connect, so it must not
    // require DATABASE_URL (CI/Docker installs). migrate/studio fail clearly
    // with "Connection url is empty" when it's missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
