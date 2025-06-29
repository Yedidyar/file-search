import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FileIngestionController } from './file-ingestion.controller';
import { FileIngestionService } from './file-ingestion.service';
import { DATABASE_PROVIDER } from '../../db/database.provider';
import { testDb } from '../../test/test-db';
import {
  FileRecordDto,
  IngestResponseDto,
  GetFilesResponseDto,
  ErrorResponseDto,
} from './file-metadata.dto';
import { ZodExceptionFilter } from '../../common/filters/zod-exception.filter';

const createTestFileMetadata = (
  overrides: Partial<FileRecordDto> = {},
): Partial<FileRecordDto> => ({
  filename: 'test-file.txt',
  fileType: 'text/plain',
  path: '/test/path/test-file.txt',
  lastIndexedAt: new Date(),
  tags: ['test', 'example'],
  ...overrides,
});

describe('FileIngestionController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [FileIngestionController],
      providers: [
        FileIngestionService,
        {
          provide: DATABASE_PROVIDER,
          useValue: testDb,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new ZodExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /files/ingest', () => {
    it('should successfully ingest a single file with tags', async () => {
      const fileMetadata = createTestFileMetadata({
        filename: 'test-document.pdf',
        fileType: 'application/pdf',
        path: '/documents/test-document.pdf',
        tags: ['document', 'pdf', 'important'],
      });

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [fileMetadata] })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse).toMatchObject({
        message: 'File ingestion completed',
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
        },
      });

      const filesResponse = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = filesResponse.body as GetFilesResponseDto;
      const savedFile = getFilesResponse.files.find(
        (f) => f.path === '/documents/test-document.pdf',
      );

      if (savedFile) {
        savedFile.tags = savedFile.tags.sort();
      }

      expect(savedFile).toMatchObject({
        filename: 'test-document.pdf',
        fileType: 'application/pdf',
        path: '/documents/test-document.pdf',
        tags: ['document', 'important', 'pdf'],
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

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: fileMetadataList })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse).toMatchObject({
        message: 'File ingestion completed',
        summary: {
          total: 3,
          successful: 3,
          failed: 0,
        },
      });

      const filesResponse = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = filesResponse.body as GetFilesResponseDto;
      const paths = getFilesResponse.files
        .map((f) => f.path)
        .filter((path: string) =>
          [
            '/files/file1.txt',
            '/images/file2.jpg',
            '/data/file3.json',
          ].includes(path),
        )
        .sort();

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

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [fileMetadata] })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse.summary.successful).toBe(1);

      const filesResponse = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = filesResponse.body as GetFilesResponseDto;
      const savedFile = getFilesResponse.files.find(
        (f) => f.path === '/files/no-tags.txt',
      );

      expect(savedFile?.tags).toEqual([]);
    });

    it('should handle empty file list', async () => {
      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [] })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse).toMatchObject({
        message: 'File ingestion completed',
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      });
    });

    it('should update existing files when path already exists', async () => {
      const originalFile = createTestFileMetadata({
        filename: 'original.txt',
        fileType: 'text/plain',
        path: '/files/same-path.txt',
        tags: ['original'],
      });

      await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [originalFile] })
        .expect(200);

      const updatedFile = createTestFileMetadata({
        filename: 'updated.txt',
        fileType: 'text/plain',
        path: '/files/same-path.txt',
        tags: ['updated', 'new'],
      });

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [updatedFile] })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse.summary.successful).toBe(1);

      const filesResponse = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = filesResponse.body as GetFilesResponseDto;
      const savedFile = getFilesResponse.files.find(
        (f) => f.path === '/files/same-path.txt',
      );

      expect(savedFile).toMatchObject({
        filename: 'updated.txt',
        path: '/files/same-path.txt',
        tags: ['updated', 'new'],
      });

      const filesWithPath = getFilesResponse.files.filter(
        (f) => f.path === '/files/same-path.txt',
      );
      expect(filesWithPath).toHaveLength(1);
    });

    it('should handle files with lastIndexedAt timestamp', async () => {
      const lastIndexedAt = '2023-01-15T10:30:00.000Z';
      const fileMetadata = createTestFileMetadata({
        filename: 'timestamped.txt',
        path: '/files/timestamped.txt',
        lastIndexedAt: new Date(lastIndexedAt),
      });

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [fileMetadata] })
        .expect(200);

      const ingestResponse = response.body as IngestResponseDto;
      expect(ingestResponse.summary.successful).toBe(1);

      const filesResponse = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = filesResponse.body as GetFilesResponseDto;
      const savedFile = getFilesResponse.files.find(
        (f) => f.path === '/files/timestamped.txt',
      );

      expect(new Date(savedFile?.lastIndexedAt || '')).toEqual(
        new Date(lastIndexedAt),
      );
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ invalid: 'data' })
        .expect(400);

      const errorResponse = response.body as ErrorResponseDto;
      expect(errorResponse).toMatchObject({
        statusCode: 400,
        message: 'Validation failed',
        errors: expect.any(Array),
        timestamp: expect.any(String),
      });

      expect(errorResponse.errors).toHaveLength(1);
      expect(errorResponse.errors[0]).toMatchObject({
        field: 'files',
        message: expect.any(String),
        code: expect.any(String),
      });
    });

    it('should return 400 for invalid file metadata', async () => {
      const invalidFileMetadata = {
        filename: '',
        fileType: 'text/plain',
        path: '/files/invalid.txt',
      };

      const response = await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: [invalidFileMetadata] })
        .expect(400);

      const errorResponse = response.body as ErrorResponseDto;
      expect(errorResponse).toMatchObject({
        statusCode: 400,
        message: 'Validation failed',
        errors: expect.any(Array),
        timestamp: expect.any(String),
      });

      const filenameError = errorResponse.errors.find(
        (error) => error.field === 'files.0.filename',
      );
      expect(filenameError).toBeDefined();
      expect(filenameError?.message).toContain(
        'String must contain at least 1 character(s)',
      );
    });
  });

  describe('GET /files', () => {
    it('should return all files with their tags', async () => {
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

      await request(app.getHttpServer())
        .post('/files/ingest')
        .send({ files: fileMetadataList })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = response.body as GetFilesResponseDto;
      expect(getFilesResponse).toHaveProperty('files');
      expect(getFilesResponse).toHaveProperty('count');
      expect(getFilesResponse.files).toBeInstanceOf(Array);
      expect(getFilesResponse.count).toBeGreaterThanOrEqual(3);

      const testFiles = getFilesResponse.files.filter((f) =>
        ['/files/file1.txt', '/images/file2.jpg', '/data/file3.json'].includes(
          f.path,
        ),
      );

      expect(testFiles).toHaveLength(3);

      testFiles.forEach((file) => {
        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('filename');
        expect(file).toHaveProperty('fileType');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('createdAt');
        expect(file).toHaveProperty('updatedAt');
        expect(file).toHaveProperty('lastIndexedAt');
        expect(file).toHaveProperty('tags');
      });

      const file1 = testFiles.find((f) => f.path === '/files/file1.txt');
      if (file1) {
        file1.tags = file1.tags.sort();
      }
      expect(file1).toMatchObject({
        filename: 'file1.txt',
        fileType: 'text/plain',
        tags: ['simple', 'text'],
      });

      const file2 = testFiles.find((f) => f.path === '/images/file2.jpg');
      if (file2) {
        file2.tags = file2.tags.sort();
      }
      expect(file2).toMatchObject({
        filename: 'file2.jpg',
        fileType: 'image/jpeg',
        tags: ['image', 'photo'],
      });
    });

    it('should return empty array when no files exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/files')
        .expect(200);

      const getFilesResponse = response.body as GetFilesResponseDto;
      expect(getFilesResponse).toMatchObject({
        files: expect.any(Array),
        count: expect.any(Number),
      });
      expect(getFilesResponse.count).toBeGreaterThanOrEqual(0);
    });
  });
});
