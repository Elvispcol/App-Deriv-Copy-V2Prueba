CREATE TABLE "copy_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"master_account_id" integer NOT NULL,
	"replication_ratio" numeric(3, 2) NOT NULL,
	"max_drawdown" numeric(5, 2) DEFAULT '100',
	"is_enabled" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "copy_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer NOT NULL,
	"master_contract_id" varchar(50),
	"slave_account_id" integer NOT NULL,
	"slave_contract_id" varchar(50),
	"status" varchar(10) NOT NULL,
	"error_msg" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_slaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer NOT NULL,
	"slave_account_id" integer NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "deriv_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"login_id" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"account_type" varchar(10) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"balance" numeric(15, 2) DEFAULT '0',
	"is_connected" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"deriv_login_id" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_deriv_login_id_unique" UNIQUE("deriv_login_id")
);
--> statement-breakpoint
ALTER TABLE "copy_configs" ADD CONSTRAINT "copy_configs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_configs" ADD CONSTRAINT "copy_configs_master_account_id_deriv_accounts_id_fk" FOREIGN KEY ("master_account_id") REFERENCES "public"."deriv_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_logs" ADD CONSTRAINT "copy_logs_config_id_copy_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."copy_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_logs" ADD CONSTRAINT "copy_logs_slave_account_id_deriv_accounts_id_fk" FOREIGN KEY ("slave_account_id") REFERENCES "public"."deriv_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_slaves" ADD CONSTRAINT "copy_slaves_config_id_copy_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."copy_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_slaves" ADD CONSTRAINT "copy_slaves_slave_account_id_deriv_accounts_id_fk" FOREIGN KEY ("slave_account_id") REFERENCES "public"."deriv_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deriv_accounts" ADD CONSTRAINT "deriv_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;