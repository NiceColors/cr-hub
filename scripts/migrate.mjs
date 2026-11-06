#!/usr/bin/env node
// Aplica as migrations do SQLite com o migrator do drizzle-orm.
// O drizzle-kit saiu das dependências; este script lê os mesmos .env* do Next.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(ROOT);

const databaseUrl = process.env.DATABASE_URL ?? "file:./.data/cr-tracker.db";
const sqlitePath = databaseUrl.replace(/^file:(\/\/)?/, "");
const absolutePath = path.isAbsolute(sqlitePath) ? sqlitePath : path.join(ROOT, sqlitePath);

fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

const sqlite = new Database(absolutePath);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.join(ROOT, "src/lib/db/migrations") });
sqlite.close();
console.log("migrations applied successfully!");
