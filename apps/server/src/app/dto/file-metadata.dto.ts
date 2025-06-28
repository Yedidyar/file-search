import { z } from 'zod';

export const FileMetadataSchema = z.object({
  filename: z.string().min(1),
  fileType: z.string().min(1),
  path: z.string().min(1),
  lastIndexedAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

export const IngestFilesSchema = z.object({
  files: z.array(FileMetadataSchema),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;
export type IngestFiles = z.infer<typeof IngestFilesSchema>;
