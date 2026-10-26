CREATE TABLE "better_auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "better_auth_accounts_user_id_index" ON "better_auth_accounts" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "better_auth_accounts_issuer_account_id_index" ON "better_auth_accounts" ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "better_auth_sessions_user_id_index" ON "better_auth_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "better_auth_verifications_identifier_index" ON "better_auth_verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "better_auth_accounts" ADD CONSTRAINT "better_auth_accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "better_auth_sessions" ADD CONSTRAINT "better_auth_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;