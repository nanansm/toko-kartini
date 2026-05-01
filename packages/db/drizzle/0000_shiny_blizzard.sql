CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TYPE "inventory"."location_type" AS ENUM('TOKO', 'GUDANG');--> statement-breakpoint
CREATE TYPE "inventory"."movement_type" AS ENUM('PURCHASE_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WASTE', 'OPENING_BALANCE');--> statement-breakpoint
CREATE TYPE "inventory"."so_session_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "inventory"."so_session_type" AS ENUM('HARIAN', 'MINGGUAN', 'BULANAN');--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"actor_id" text NOT NULL,
	"actor_email" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'STAF_GUDANG' NOT NULL,
	"assigned_locations" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"l1" text NOT NULL,
	"l2" text,
	"product_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"customer_type" text,
	"pic_name" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"pricing_tier" text DEFAULT 'HJ2' NOT NULL,
	"credit_limit_rp" numeric(14, 2) DEFAULT '0',
	"payment_term_days" integer DEFAULT 0,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."locations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "inventory"."location_type" NOT NULL,
	"address" text,
	"distance_km_from_main" numeric(6, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory"."product_units" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"unit_name" text NOT NULL,
	"unit_level" integer NOT NULL,
	"qty_in_base_unit" integer NOT NULL,
	"is_base_unit" boolean DEFAULT false NOT NULL,
	"is_default_purchase" boolean DEFAULT false NOT NULL,
	"is_default_sell" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_l1" text NOT NULL,
	"category_l2" text,
	"supplier_id" text,
	"hpp_per_l1" numeric(14, 2),
	"sell_price_grosir_l1" numeric(14, 2),
	"sell_price_hj1" numeric(14, 2),
	"sell_price_hj2" numeric(14, 2),
	"sell_price_hj3" numeric(14, 2),
	"current_avg_hpp" numeric(14, 2),
	"olsera_sku" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"location_id" text NOT NULL,
	"qty_in_base" numeric(14, 2) DEFAULT '0' NOT NULL,
	"avg_hpp" numeric(14, 2),
	"last_movement_at" timestamp,
	"last_counted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_count_items" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"product_id" text NOT NULL,
	"qty_system_base" numeric(14, 2) NOT NULL,
	"hpp_at_count" numeric(14, 2),
	"qty_physical_input" text,
	"qty_physical_base" numeric(14, 2),
	"difference_base" numeric(14, 2),
	"difference_value_rp" numeric(14, 2),
	"is_counted" boolean DEFAULT false NOT NULL,
	"notes" text,
	"counted_by" text,
	"counted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_count_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "inventory"."so_session_type" NOT NULL,
	"location_id" text NOT NULL,
	"status" "inventory"."so_session_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"approved_by" text,
	"total_items_count" integer DEFAULT 0,
	"total_differences" integer DEFAULT 0,
	"total_value_rp" numeric(14, 2),
	"total_difference_value_rp" numeric(14, 2),
	"notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"location_id" text NOT NULL,
	"movement_type" "inventory"."movement_type" NOT NULL,
	"qty_in_base" numeric(14, 2) NOT NULL,
	"unit_name_used" text NOT NULL,
	"qty_in_unit_used" numeric(14, 2) NOT NULL,
	"hpp_at_movement" numeric(14, 2),
	"total_value_rp" numeric(14, 2),
	"reference_movement_id" text,
	"source_type" text,
	"source_id" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pic_name" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"payment_term_days" integer DEFAULT 0,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "inventory"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_balances" ADD CONSTRAINT "stock_balances_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD CONSTRAINT "stock_count_items_session_id_stock_count_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "inventory"."stock_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_cat_l1_l2" ON "inventory"."categories" USING btree ("l1","l2");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_product_unit_level" ON "inventory"."product_units" USING btree ("product_id","unit_level");--> statement-breakpoint
CREATE INDEX "idx_product_unit_product" ON "inventory"."product_units" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_name" ON "inventory"."products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_product_category" ON "inventory"."products" USING btree ("category_l1","category_l2");--> statement-breakpoint
CREATE INDEX "idx_product_supplier" ON "inventory"."products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_product_olsera_sku" ON "inventory"."products" USING btree ("olsera_sku");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_stock_product_location" ON "inventory"."stock_balances" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_stock_location" ON "inventory"."stock_balances" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_so_session_product" ON "inventory"."stock_count_items" USING btree ("session_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_so_item_session" ON "inventory"."stock_count_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_movement_product" ON "inventory"."stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_movement_location" ON "inventory"."stock_movements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_movement_type" ON "inventory"."stock_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "idx_movement_created_at" ON "inventory"."stock_movements" USING btree ("created_at");