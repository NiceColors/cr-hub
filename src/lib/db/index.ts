import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";

function resolveSqlitePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    const raw = databaseUrl.slice("file:".length);
    const cleaned = raw.startsWith("//") ? raw.slice(2) : raw;
    return cleaned;
  }
  return databaseUrl;
}

const url = process.env.DATABASE_URL ?? "file:./.data/cr-tracker.db";
const sqlitePath = resolveSqlitePath(url);
const absolutePath = path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.join(/*turbopackIgnore: true*/ process.cwd(), sqlitePath);

fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

const sqlite = new Database(absolutePath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

