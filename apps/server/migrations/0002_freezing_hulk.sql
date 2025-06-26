CREATE TYPE "public"."scan_status" AS ENUM('success', 'error', 'skipped');--> statement-breakpoint
CREATE TABLE "scan_path_ignores" (
	"scan_path_id" uuid NOT NULL,
	"pattern" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_glob" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"next_scan_at" timestamp with time zone,
	"last_status" "scan_status",
	"last_error_message" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"scan_interval" interval NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_path_ignores" ADD CONSTRAINT "scan_path_ignores_scan_path_id_scan_paths_id_fk" FOREIGN KEY ("scan_path_id") REFERENCES "public"."scan_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;