import { buildApp } from "./app.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PostgresAuthRepository } from "./auth/postgres-repository.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { PostgresDocumentRepository } from "./documents/postgres-repository.js";
import { S3ObjectStore } from "./storage/object-store.js";
import { PostgresSyncRepository } from "./sync/postgres-repository.js";
import { PostgresUsageRepository } from "./usage/postgres-repository.js";
import { DictionaryStore } from "./dictionary/store.js";

const config = loadConfig();
const { client, db } = createDatabase(config);
const objectStore = new S3ObjectStore(config);
await objectStore.ensureBucket();
const dictionaryPath = config.DICTIONARY_PATH ?? [
  resolve(process.cwd(), "data/ecdict.sqlite"),
  resolve(process.cwd(), "../data/ecdict.sqlite"),
].find(candidate => existsSync(candidate));
if (!dictionaryPath) throw new Error("Dictionary database not found; set DICTIONARY_PATH");
const dictionaryStore = new DictionaryStore(dictionaryPath);
const app = buildApp({
  config,
  authRepository: new PostgresAuthRepository(db),
  documentRepository: new PostgresDocumentRepository(db),
  objectStore,
  syncRepository: new PostgresSyncRepository(db),
  usageRepository: new PostgresUsageRepository(db),
  dictionaryStore,
});
app.addHook("onClose", async () => {
  dictionaryStore.close();
  await client.end();
});

try {
  await app.listen({ host: "0.0.0.0", port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
