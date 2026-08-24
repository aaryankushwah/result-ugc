import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

export type ResultDatabase = ReturnType<typeof drizzle<typeof schema>>;

let connection: ReturnType<typeof postgres> | undefined;
let database: ResultDatabase | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase(): ResultDatabase {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!connection) {
    connection = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
    });
    database = drizzle(connection, { schema });
  }
  return database as ResultDatabase;
}

export async function closeDatabase(): Promise<void> {
  if (connection) await connection.end({ timeout: 5 });
  connection = undefined;
  database = undefined;
}
