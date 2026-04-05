CREATE TABLE IF NOT EXISTS "discord_muted_admin_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"removed_role_ids" text NOT NULL,
	"mute_expires_at" timestamp NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_muted_admin_roles_discord_id_unique" UNIQUE("discord_id")
);
