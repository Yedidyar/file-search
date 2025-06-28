import { Injectable, Inject } from '@nestjs/common';
import { files, tags } from '../../db/schema';
import { eq, inArray, SQL, sql } from 'drizzle-orm';
import { FileMetadata } from './file-metadata.dto';
import { DATABASE_PROVIDER } from '../../db/database.provider';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema';

@Injectable()
export class FileIngestionService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

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

    return await this.db.transaction(async (tx) => {
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

      const setObject = Object.keys(fileValues[0]).reduce(
        (acc, key) => {
          // Convert camelCase keys to snake_case for database compatibility,
          // this is specially necessary if you have relationships
          const columnName = key.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`,
          );
          acc[columnName] = sql.raw(`excluded."${columnName}"`);
          return acc;
        },
        {} as Record<string, SQL>,
      );

      const upsertedFiles = await tx
        .insert(files)
        .values(fileValues)
        .onConflictDoUpdate({
          target: files.path,
          set: setObject,
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

      return results;
    });
  }

  async getFiles() {
    const filesWithTags = await this.db
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
