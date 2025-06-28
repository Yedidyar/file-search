import '../../test/setup';
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FileIngestionService } from './file-ingestion.service';
import {
  createTestFileMetadata,
  getAllFiles,
  getFileWithTags,
} from './file-ingestion-test-utils';
import { DATABASE_PROVIDER } from '../../db/database.provider';
import { getTestDb } from '../../test/setup';

describe('FileIngestionService', () => {
  let service: FileIngestionService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        FileIngestionService,
        {
          provide: DATABASE_PROVIDER,
          useValue: getTestDb(),
        },
      ],
    }).compile();

    service = module.get<FileIngestionService>(FileIngestionService);
  });

  describe('ingestFiles', () => {
    it('should successfully ingest a single file with tags', async () => {
      const fileMetadata = createTestFileMetadata({
        filename: 'test-document.pdf',
        fileType: 'application/pdf',
        path: '/documents/test-document.pdf',
        tags: ['document', 'pdf', 'important'],
      });

      const result = await service.ingestFiles([fileMetadata]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        success: true,
        path: '/documents/test-document.pdf',
        action: 'upserted',
      });
      expect(result[0].fileId).toBeDefined();

      // Verify the file was actually saved to the database
      const savedFile = await getFileWithTags(result[0].fileId!);
      expect(savedFile).toMatchObject({
        filename: 'test-document.pdf',
        fileType: 'application/pdf',
        path: '/documents/test-document.pdf',
        tags: ['document', 'pdf', 'important'],
      });
    });

    it('should successfully ingest multiple files', async () => {
      const fileMetadataList = [
        createTestFileMetadata({
          filename: 'file1.txt',
          path: '/files/file1.txt',
          tags: ['text', 'simple'],
        }),
        createTestFileMetadata({
          filename: 'file2.jpg',
          fileType: 'image/jpeg',
          path: '/images/file2.jpg',
          tags: ['image', 'photo'],
        }),
        createTestFileMetadata({
          filename: 'file3.json',
          fileType: 'application/json',
          path: '/data/file3.json',
          tags: ['data', 'json'],
        }),
      ];

      const result = await service.ingestFiles(fileMetadataList);

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.success)).toBe(true);
      expect(result.every((r) => r.action === 'upserted')).toBe(true);

      // Verify all files were saved
      const allFiles = await getAllFiles();
      expect(allFiles).toHaveLength(3);

      const paths = allFiles.map((f) => f.path).sort();
      expect(paths).toEqual([
        '/data/file3.json',
        '/files/file1.txt',
        '/images/file2.jpg',
      ]);
    });

    it('should handle files without tags', async () => {
      const fileMetadata = createTestFileMetadata({
        filename: 'no-tags.txt',
        path: '/files/no-tags.txt',
        tags: undefined,
      });

      const result = await service.ingestFiles([fileMetadata]);

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);

      const savedFile = await getFileWithTags(result[0].fileId!);
      expect(savedFile?.tags).toEqual([]);
    });

    it('should handle empty file list', async () => {
      const result = await service.ingestFiles([]);

      expect(result).toEqual([]);
    });

    it('should update existing files when path already exists', async () => {
      const originalFile = createTestFileMetadata({
        filename: 'original.txt',
        fileType: 'text/plain',
        path: '/files/same-path.txt',
        tags: ['original'],
      });

      await service.ingestFiles([originalFile]);

      const updatedFile = createTestFileMetadata({
        filename: 'updated.txt',
        fileType: 'text/plain',
        path: '/files/same-path.txt',
        tags: ['updated', 'new'],
      });

      const result = await service.ingestFiles([updatedFile]);

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(result[0].action).toBe('upserted');

      const savedFile = await getFileWithTags(result[0].fileId!);
      expect(savedFile).toMatchObject({
        filename: 'updated.txt',
        path: '/files/same-path.txt',
        tags: ['updated', 'new'],
      });

      const allFiles = await getAllFiles();
      const filesWithPath = allFiles.filter(
        (f) => f.path === '/files/same-path.txt',
      );
      expect(filesWithPath).toHaveLength(1);
    });

    it('should handle files with lastIndexedAt timestamp', async () => {
      const lastIndexedAt = '2023-01-15T10:30:00.000Z';
      const fileMetadata = createTestFileMetadata({
        filename: 'timestamped.txt',
        path: '/files/timestamped.txt',
        lastIndexedAt,
      });

      const result = await service.ingestFiles([fileMetadata]);

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);

      const savedFile = await getFileWithTags(result[0].fileId!);
      expect(savedFile?.lastIndexedAt).toEqual(new Date(lastIndexedAt));
    });
  });

  describe('getFiles', () => {
    it('should return empty array when no files exist', async () => {
      const files = await service.getFiles();

      expect(files).toEqual([]);
    });

    it('should return all files with their tags', async () => {
      // Create some test files
      const fileMetadataList = [
        createTestFileMetadata({
          filename: 'file1.txt',
          path: '/files/file1.txt',
          tags: ['text', 'simple'],
        }),
        createTestFileMetadata({
          filename: 'file2.jpg',
          fileType: 'image/jpeg',
          path: '/images/file2.jpg',
          tags: ['image', 'photo'],
        }),
        createTestFileMetadata({
          filename: 'file3.json',
          fileType: 'application/json',
          path: '/data/file3.json',
          tags: ['data', 'json'],
        }),
      ];

      await service.ingestFiles(fileMetadataList);

      const files = await service.getFiles();

      expect(files).toHaveLength(3);

      // Verify files are ordered by createdAt
      const paths = files.map((f) => f.path);
      expect(paths).toEqual([
        '/files/file1.txt',
        '/images/file2.jpg',
        '/data/file3.json',
      ]);

      // Verify each file has the correct structure
      files.forEach((file) => {
        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('filename');
        expect(file).toHaveProperty('fileType');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('createdAt');
        expect(file).toHaveProperty('updatedAt');
        expect(file).toHaveProperty('lastIndexedAt');
        expect(file).toHaveProperty('tags');
        expect(Array.isArray(file.tags)).toBe(true);
      });

      // Verify specific file data
      const file1 = files.find((f) => f.path === '/files/file1.txt');
      expect(file1).toMatchObject({
        filename: 'file1.txt',
        fileType: 'text/plain',
        tags: ['text', 'simple'],
      });

      const file2 = files.find((f) => f.path === '/images/file2.jpg');
      expect(file2).toMatchObject({
        filename: 'file2.jpg',
        fileType: 'image/jpeg',
        tags: ['image', 'photo'],
      });
    });

    it('should handle files without tags', async () => {
      const fileMetadata = createTestFileMetadata({
        filename: 'no-tags.txt',
        path: '/files/no-tags.txt',
        tags: undefined,
      });

      await service.ingestFiles([fileMetadata]);

      const files = await service.getFiles();

      expect(files).toHaveLength(1);
      expect(files[0].tags).toEqual([]);
    });
  });
});
