import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

const config = loadConfig();
const { client, db } = createDatabase(config);

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
} finally {
  await client.end();
}
