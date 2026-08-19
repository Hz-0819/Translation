CREATE TABLE "upload_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"byte_size" bigint NOT NULL,
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upload_reservations" ADD CONSTRAINT "upload_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_reservations_document_unique" ON "upload_reservations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "upload_reservations_user_status_idx" ON "upload_reservations" USING btree ("user_id","status");