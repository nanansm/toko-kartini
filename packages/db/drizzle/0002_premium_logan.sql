CREATE SCHEMA "pos";
--> statement-breakpoint
CREATE TYPE "pos"."payment_method_type" AS ENUM('CASH', 'TRANSFER', 'QRIS', 'CARD', 'TEMPO');--> statement-breakpoint
CREATE TYPE "pos"."return_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "pos"."shift_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "pos"."transaction_status" AS ENUM('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "pos"."payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "pos"."payment_method_type" NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "pos"."receipt_config" (
	"id" text PRIMARY KEY NOT NULL,
	"store_name" text DEFAULT 'TOKO KARTINI' NOT NULL,
	"store_address" text,
	"store_phone" text,
	"header_text" text,
	"footer_text" text DEFAULT 'Terima kasih telah berbelanja!',
	"show_logo" boolean DEFAULT false NOT NULL,
	"paper_width" integer DEFAULT 80 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos"."return_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"return_items" text NOT NULL,
	"total_return_amount" numeric(14, 2) NOT NULL,
	"status" "pos"."return_status" DEFAULT 'PENDING' NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_by" text,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos"."shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"cashier_id" text NOT NULL,
	"cashier_name" text NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_cash" numeric(14, 2) DEFAULT '0' NOT NULL,
	"closing_cash" numeric(14, 2),
	"expected_cash" numeric(14, 2),
	"cash_difference" numeric(14, 2),
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_cash_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_non_cash_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_refunds" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "pos"."shift_status" DEFAULT 'OPEN' NOT NULL,
	"opening_notes" text,
	"closing_notes" text,
	"closed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos"."transaction_items" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text,
	"unit_name" text NOT NULL,
	"qty_in_base_unit" numeric(14, 4) NOT NULL,
	"qty" numeric(10, 2) NOT NULL,
	"price_per_unit" numeric(14, 2) NOT NULL,
	"original_price_per_unit" numeric(14, 2),
	"discount_per_unit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"hpp_per_unit" numeric(14, 2),
	"is_price_override" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"override_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos"."transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_no" text NOT NULL,
	"shift_id" text NOT NULL,
	"cashier_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_method_id" text,
	"payment_method_type" "pos"."payment_method_type",
	"amount_paid" numeric(14, 2),
	"change_amount" numeric(14, 2),
	"status" "pos"."transaction_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	CONSTRAINT "transactions_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE INDEX "idx_shift_cashier" ON "pos"."shifts" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "idx_shift_status" ON "pos"."shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_shift_opened_at" ON "pos"."shifts" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "idx_item_transaction" ON "pos"."transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_item_product" ON "pos"."transaction_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_shift" ON "pos"."transactions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_cashier" ON "pos"."transactions" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_status" ON "pos"."transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transaction_created_at" ON "pos"."transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_receipt_no" ON "pos"."transactions" USING btree ("receipt_no");