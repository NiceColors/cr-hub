import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { Config } from "drizzle-kit";

// Mesmos arquivos .env* que o Next lê, para migrations e app usarem o mesmo banco.
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL ?? "file:./.data/cr-tracker.db";

const sqlitePath = databaseUrl.replace(/^file:(\/\/)?/, "");
fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });

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
