import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = buildApp();

try {
  await app.listen({ host: "0.0.0.0", port: config.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
