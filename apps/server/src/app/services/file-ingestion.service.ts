import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { files, tags } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { FileMetadata } from '../dto/file-metadata.dto';

@Injectable()
export class FileIngestionService {
  async ingestFiles(fileMetadataList: FileMetadata[]) {
    if (fileMetadataList.length === 0) {
      return [];
    }

    const results: {
      success: boolean;
      fileId?: string;
      path: string;
      action?: string;
      error?: string;
    }[] = [];

    try {
      await db.transaction(async (tx) => {
        const fileValues = fileMetadataList.map((fileMetadata) => ({
          filename: fileMetadata.filename,
          fileType: fileMetadata.fileType,
          path: fileMetadata.path,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastIndexedAt: fileMetadata.lastIndexedAt
            ? new Date(fileMetadata.lastIndexedAt)
            : new Date(),
        }));

        const upsertedFiles = await tx
          .insert(files)
          .values(fileValues)
          .onConflictDoUpdate({
            target: files.path,
            set: {
              filename: files.filename,
              fileType: files.fileType,
              updatedAt: files.updatedAt,
              lastIndexedAt: files.lastIndexedAt,
            },
          })
          .returning();

        const pathToFileId = new Map(
          upsertedFiles.map((file) => [file.path, file.id]),
        );

        const fileIds = upsertedFiles.map((file) => file.id);
        if (fileIds.length > 0) {
          await tx.delete(tags).where(inArray(tags.fileId, fileIds));
        }

        const tagValues = [];
        for (const fileMetadata of fileMetadataList) {
          if (fileMetadata.tags && fileMetadata.tags.length > 0) {
            const fileId = pathToFileId.get(fileMetadata.path);
            if (fileId) {
              for (const tag of fileMetadata.tags) {
                tagValues.push({
                  fileId,
                  name: tag,
                });
              }
            }
          }
        }

        if (tagValues.length > 0) {
          await tx.insert(tags).values(tagValues);
        }

        for (const fileMetadata of fileMetadataList) {
          const fileId = pathToFileId.get(fileMetadata.path);
          if (fileId) {
            results.push({
              success: true,
              fileId,
              path: fileMetadata.path,
              action: 'upserted',
            });
          } else {
            results.push({
              success: false,
              path: fileMetadata.path,
              error: 'Failed to upsert file',
            });
          }
        }
      });
    } catch (error) {
      console.error(
        'Batch upsert failed, falling back to individual processing:',
        error,
      );
    }

    return results;
  }

  async getFiles() {
    const filesWithTags = await db
      .select({
        id: files.id,
        filename: files.filename,
        fileType: files.fileType,
        path: files.path,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
        lastIndexedAt: files.lastIndexedAt,
        tags: tags.name,
      })
      .from(files)
      .leftJoin(tags, eq(files.id, tags.fileId))
      .orderBy(files.createdAt);

    const fileMap = new Map();

    for (const row of filesWithTags) {
      if (!fileMap.has(row.id)) {
        fileMap.set(row.id, {
          id: row.id,
          filename: row.filename,
          fileType: row.fileType,
          path: row.path,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lastIndexedAt: row.lastIndexedAt,
          tags: [],
        });
      }

      if (row.tags) {
        fileMap.get(row.id).tags.push(row.tags);
      }
    }

    return Array.from(fileMap.values());
  }
}
