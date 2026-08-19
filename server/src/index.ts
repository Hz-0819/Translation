import { buildApp } from "./app.js";
import { PostgresAuthRepository } from "./auth/postgres-repository.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { PostgresDocumentRepository } from "./documents/postgres-repository.js";
import { S3ObjectStore } from "./storage/object-store.js";

const config = loadConfig();
const { client, db } = createDatabase(config);
const objectStore = new S3ObjectStore(config);
await objectStore.ensureBucket();
const app = buildApp({
  config,
  authRepository: new PostgresAuthRepository(db),
  documentRepository: new PostgresDocumentRepository(db),
  objectStore,
});
app.addHook("onClose", async () => client.end());

try {
  await app.listen({ host: "0.0.0.0", port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
