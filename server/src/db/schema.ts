import {
  bigserial,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 120 }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    platform: varchar("platform", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("devices_user_id_idx").on(table.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_refresh_token_hash_unique").on(table.refreshTokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sourceKind: varchar("source_kind", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("ready"),
    pageCount: integer("page_count").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("documents_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const documentObjects = pgTable(
  "document_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    version: integer("version").notNull().default(1),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    failureReason: varchar("failure_reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("document_objects_key_unique").on(table.objectKey),
    index("document_objects_document_id_idx").on(table.documentId),
  ],
);

export const layers = pgTable(
  "layers",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull().default("annotation"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    isLocked: boolean("is_locked").notNull().default(false),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("layers_document_order_idx").on(table.documentId, table.sortOrder)],
);

export const annotationOps = pgTable(
  "annotation_ops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    layerId: uuid("layer_id").references(() => layers.id, { onDelete: "set null" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    operationType: varchar("operation_type", { length: 80 }).notNull(),
    payload: jsonb("payload").notNull(),
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }).notNull(),
    serverSequence: bigserial("server_sequence", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("annotation_ops_user_operation_unique").on(table.userId, table.operationId),
    uniqueIndex("annotation_ops_server_sequence_unique").on(table.serverSequence),
    index("annotation_ops_document_sequence_idx").on(table.documentId, table.serverSequence),
  ],
);

export const excerpts = pgTable(
  "excerpts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    title: varchar("title", { length: 500 }),
    note: text("note"),
    selection: jsonb("selection").notNull(),
    imageObjectKey: text("image_object_key"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("excerpts_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const outlines = pgTable(
  "outlines",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: varchar("title", { length: 500 }).notNull(),
    pageNumber: integer("page_number").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("outlines_document_order_idx").on(table.documentId, table.sortOrder)],
);

export const mistakeBooks = pgTable(
  "mistake_books",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    subject: varchar("subject", { length: 120 }),
    description: text("description"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("mistake_books_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const mistakeEntries = pgTable(
  "mistake_entries",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mistakeBookId: uuid("mistake_book_id").notNull().references(() => mistakeBooks.id, { onDelete: "cascade" }),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, { onDelete: "set null" }),
    sourcePageNumber: integer("source_page_number"),
    title: varchar("title", { length: 500 }),
    note: text("note"),
    selection: jsonb("selection"),
    imageObjectKey: text("image_object_key"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("mistake_entries_book_updated_idx").on(table.mistakeBookId, table.updatedAt)],
);

export const syncCursors = pgTable(
  "sync_cursors",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    cursor: bigserial("cursor", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.deviceId] })],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    limits: jsonb("limits").notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("plans_code_unique").on(table.code)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    status: varchar("status", { length: 40 }).notNull(),
    provider: varchar("provider", { length: 80 }),
    providerReference: varchar("provider_reference", { length: 255 }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    ...timestamps,
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [index("subscriptions_user_status_idx").on(table.userId, table.status)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    metric: varchar("metric", { length: 80 }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("usage_records_period_unique").on(table.userId, table.metric, table.periodStart)],
);

export const uploadReservations = pgTable(
  "upload_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("upload_reservations_document_unique").on(table.documentId),
    index("upload_reservations_user_status_idx").on(table.userId, table.status),
  ],
);
