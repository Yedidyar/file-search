import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileIngestionService } from '../services/file-ingestion.service';
import { IngestFilesSchema } from '../dto/file-metadata.dto';

@Controller('files')
export class FileIngestionController {
  constructor(private readonly fileIngestionService: FileIngestionService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingestFiles(@Body() body: unknown) {
    const validatedData = IngestFilesSchema.parse(body);

    const results = await this.fileIngestionService.ingestFiles(
      validatedData.files,
    );

    return {
      message: 'File ingestion completed',
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  }

  @Get()
  async getFiles() {
    const files = await this.fileIngestionService.getFiles();

    return {
      files,
      count: files.length,
    };
  }
}
