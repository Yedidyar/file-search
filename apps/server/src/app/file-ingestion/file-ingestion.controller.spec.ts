import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FileIngestionController } from './file-ingestion.controller';
import { FileIngestionService } from './file-ingestion.service';

describe('FileIngestionController', () => {
  let controller: FileIngestionController;
  let service: FileIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileIngestionController],
      providers: [
        {
          provide: FileIngestionService,
          useValue: {
            ingestFiles: vi.fn(),
            getFiles: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FileIngestionController>(FileIngestionController);
    service = module.get<FileIngestionService>(FileIngestionService);
  });

  describe('ingestFiles', () => {
    it('should process file ingestion', async () => {
      const mockFiles = [
        {
          filename: 'test.txt',
          fileType: 'text/plain',
          path: '/path/to/test.txt',
          tags: ['test', 'document'],
        },
      ];

      const mockResults = [
        {
          success: true,
          fileId: '123',
          path: '/path/to/test.txt',
          action: 'created',
        },
      ];

      vi.spyOn(service, 'ingestFiles').mockResolvedValue(mockResults);

      const result = await controller.ingestFiles({ files: mockFiles });

      expect(service.ingestFiles).toHaveBeenCalledWith(mockFiles);
      expect(result).toEqual({
        message: 'File ingestion completed',
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
        },
      });
    });

    it('should return error if files are not provided', async () => {
      await expect(controller.ingestFiles({})).rejects.toThrow();
    });
  });

  describe('getFiles', () => {
    it('should return list of files', async () => {
      const mockFiles = [
        {
          id: '123',
          filename: 'test.txt',
          fileType: 'text/plain',
          path: '/path/to/test.txt',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastIndexedAt: new Date(),
          tags: ['test'],
        },
      ];

      vi.spyOn(service, 'getFiles').mockResolvedValue(mockFiles);

      const result = await controller.getFiles();

      expect(service.getFiles).toHaveBeenCalled();
      expect(result).toEqual({
        files: mockFiles,
        count: 1,
      });
    });
  });
});
