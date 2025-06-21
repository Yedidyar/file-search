CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"file_type" text NOT NULL,
	"path" text NOT NULL,
	"directory" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"lastIndexedAt" timestamp with time zone NOT NULL
);
