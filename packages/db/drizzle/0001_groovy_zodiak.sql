CREATE TYPE "inventory"."so_item_status" AS ENUM('PENDING', 'COUNTED', 'NEEDS_RECOUNT', 'AUTO_APPROVED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "inventory"."so_session_status" ADD VALUE 'IN_PROGRESS' BEFORE 'SUBMITTED';--> statement-breakpoint
CREATE TABLE "inventory"."olsera_import_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"file_md5" text,
	"period_from" timestamp,
	"period_to" timestamp,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"movements_created" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"rows_error" integer DEFAULT 0 NOT NULL,
	"total_value_rp" numeric(14, 2),
	"status" text NOT NULL,
	"error_message" text,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"committed_by" text,
	"committed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory"."olsera_import_staging" (
	"id" text PRIMARY KEY NOT NULL,
	"import_log_id" text NOT NULL,
	"row_index" integer NOT NULL,
	"order_no" text NOT NULL,
	"product_id" text NOT NULL,
	"location_id" text NOT NULL,
	"qty_in_base" numeric(14, 2) NOT NULL,
	"unit_name_used" text NOT NULL,
	"qty_in_unit_used" numeric(14, 2) NOT NULL,
	"hpp_at_movement" numeric(14, 2),
	"total_value_rp" numeric(14, 2),
	"raw_row" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "difference_percent" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "status" "inventory"."so_item_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "approval_reason" text;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "rejected_by" text;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "recount_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD COLUMN "generated_movement_id" text;--> statement-breakpoint
ALTER TABLE "inventory"."olsera_import_staging" ADD CONSTRAINT "olsera_import_staging_import_log_id_olsera_import_logs_id_fk" FOREIGN KEY ("import_log_id") REFERENCES "inventory"."olsera_import_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."olsera_import_staging" ADD CONSTRAINT "olsera_import_staging_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."olsera_import_staging" ADD CONSTRAINT "olsera_import_staging_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_olsera_staging_log" ON "inventory"."olsera_import_staging" USING btree ("import_log_id");--> statement-breakpoint
CREATE INDEX "idx_so_item_status" ON "inventory"."stock_count_items" USING btree ("status");