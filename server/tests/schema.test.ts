import assert from "node:assert/strict";
import test from "node:test";

import { getTableName } from "drizzle-orm";

import * as schema from "../src/db/schema.js";

test("storage schema exposes every first-version domain table", () => {
  const tables = [
    schema.users,
    schema.sessions,
    schema.devices,
    schema.documents,
    schema.documentObjects,
    schema.layers,
    schema.annotationOps,
    schema.excerpts,
    schema.outlines,
    schema.mistakeBooks,
    schema.mistakeEntries,
    schema.syncCursors,
    schema.plans,
    schema.subscriptions,
    schema.usageRecords,
  ];

  assert.deepEqual(tables.map(getTableName), [
    "users",
    "sessions",
    "devices",
    "documents",
    "document_objects",
    "layers",
    "annotation_ops",
    "excerpts",
    "outlines",
    "mistake_books",
    "mistake_entries",
    "sync_cursors",
    "plans",
    "subscriptions",
    "usage_records",
  ]);
});
