import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

test("GET /api/health reports that the API is ready", async () => {
  const app = buildApp();

  const response = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  await app.close();
});
