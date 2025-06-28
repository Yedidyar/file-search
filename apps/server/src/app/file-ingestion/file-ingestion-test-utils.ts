import { getTestDb } from '../../test/setup';
import { files, tags } from '../../db/schema';
import { FileMetadata } from './file-metadata.dto';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema';

export const getFileWithTags = async (
  fileId: string,
  db?: NodePgDatabase<typeof schema>,
) => {
  const database = db || getTestDb();

  const filesWithTags = await database
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
    .where(eq(files.id, fileId));

  if (filesWithTags.length === 0) {
    return null;
  }

  const file = {
    id: filesWithTags[0].id,
    filename: filesWithTags[0].filename,
    fileType: filesWithTags[0].fileType,
    path: filesWithTags[0].path,
    createdAt: filesWithTags[0].createdAt,
    updatedAt: filesWithTags[0].updatedAt,
    lastIndexedAt: filesWithTags[0].lastIndexedAt,
    tags: filesWithTags
      .map((row) => row.tags)
      .filter((tag) => tag !== null) as string[],
  };

  return file;
};

export const getAllFiles = async (db?: NodePgDatabase<typeof schema>) => {
  const database = db || getTestDb();

  const filesWithTags = await database
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
};

export const createTestFileMetadata = (
  overrides: Partial<FileMetadata> = {},
): FileMetadata => ({
  filename: 'test-file.txt',
  fileType: 'text/plain',
  path: '/test/path/test-file.txt',
  lastIndexedAt: new Date().toISOString(),
  tags: ['test', 'example'],
  ...overrides,
});
