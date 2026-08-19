import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { AppConfig } from "../config.js";
import * as schema from "./schema.js";

export function createDatabase(config: Pick<AppConfig, "DATABASE_URL">) {
  const client = postgres(config.DATABASE_URL, { max: 10 });
  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
