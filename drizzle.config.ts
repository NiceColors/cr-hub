import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "file:./.data/cr-tracker.db";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: false,
  strict: true,
} satisfies Config;

