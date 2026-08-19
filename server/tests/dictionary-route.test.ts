import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/app.js";
import { DictionaryStore } from "../src/dictionary/store.js";

test("production API serves the complete dictionary", async () => {
  const store = new DictionaryStore(fileURLToPath(new URL("../../data/ecdict.sqlite", import.meta.url)));
  const app = buildApp({ dictionaryStore: store });
  try {
    const response = await app.inject({ method: "GET", url: "/api/dictionary?q=zyzzyva" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().word.toLowerCase(), "zyzzyva");
    assert.equal(response.headers["cache-control"], "public, max-age=86400");
  } finally {
    await app.close();
    store.close();
  }
});
