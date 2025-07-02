import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FileMetadataSchema = z.object({
  filename: z.string().min(1).describe('Name of the file'),
  fileType: z.string().min(1).describe('MIME type of the file'),
  path: z.string().min(1).describe('Full path to the file'),
  lastIndexedAt: z
    .string()
    .datetime()
    .optional()
    .describe('When the file was last indexed'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Array of tags associated with the file'),
});

export const IngestFilesSchema = z.object({
  files: z.array(FileMetadataSchema).describe('Array of files to ingest'),
});

// Response schemas
export const FileRecordSchema = z.object({
  id: z.string().uuid().describe('Unique identifier for the file record'),
  filename: z.string().describe('Name of the file'),
  fileType: z.string().describe('MIME type of the file'),
  path: z.string().describe('Full path to the file'),
  createdAt: z.date().describe('When the record was created'),
  updatedAt: z.date().describe('When the record was last updated'),
  lastIndexedAt: z.date().describe('When the file was last indexed'),
  tags: z.array(z.string()).describe('Array of tags associated with the file'),
});

export const IngestResponseSchema = z.object({
  message: z.string().describe('Success message'),
  summary: z
    .object({
      total: z.number().describe('Total number of files processed'),
      successful: z.number().describe('Number of files successfully ingested'),
      failed: z.number().describe('Number of files that failed to ingest'),
    })
    .describe('Summary of the ingestion process'),
});

export const GetFilesResponseSchema = z.object({
  files: z.array(FileRecordSchema).describe('Array of file records'),
  count: z.number().describe('Total number of files returned'),
});

// Error response schemas (from ZodExceptionFilter)
export const ValidationErrorSchema = z.object({
  field: z.string().describe('Field that failed validation'),
  message: z.string().describe('Validation error message'),
  code: z.string().describe('Validation error code'),
});

export const ErrorResponseSchema = z.object({
  statusCode: z.number().describe('HTTP status code'),
  message: z.string().describe('Error message'),
  errors: z.array(ValidationErrorSchema).describe('Array of validation errors'),
  timestamp: z.string().describe('Timestamp when the error occurred'),
});

export class FileMetadataDto extends createZodDto(FileMetadataSchema) {}
export class IngestFilesDto extends createZodDto(IngestFilesSchema) {}
export class FileRecordDto extends createZodDto(FileRecordSchema) {}
export class IngestResponseDto extends createZodDto(IngestResponseSchema) {}
export class GetFilesResponseDto extends createZodDto(GetFilesResponseSchema) {}
export class ValidationErrorDto extends createZodDto(ValidationErrorSchema) {}
export class ErrorResponseDto extends createZodDto(ErrorResponseSchema) {}
