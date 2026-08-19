ALTER TABLE "document_objects" ALTER COLUMN "byte_size" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "document_objects" ADD COLUMN "status" varchar(40) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_objects" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_objects" ADD COLUMN "failure_reason" varchar(255);