import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { FileIngestionService } from './file-ingestion.service';
import {
  IngestFilesDto,
  IngestResponseDto,
  GetFilesResponseDto,
  ErrorResponseDto,
  IngestFilesSchema,
} from './file-metadata.dto';

@ApiTags('files')
@Controller('files')
export class FileIngestionController {
  constructor(private readonly fileIngestionService: FileIngestionService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingest multiple files',
    description:
      'Ingests multiple files into the system for indexing and search',
  })
  @ApiBody({
    type: IngestFilesDto,
    description: 'Array of files to ingest with their metadata',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Files successfully ingested',
    type: IngestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  async ingestFiles(@Body() body: IngestFilesDto): Promise<IngestResponseDto> {
    const validatedData = IngestFilesSchema.parse(body);

    const results = await this.fileIngestionService.ingestFiles(
      validatedData.files,
    );

    const response: IngestResponseDto = {
      message: 'File ingestion completed',
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };

    return response;
  }

  @Get()
  @ApiOperation({
    summary: 'Get all files',
    description: 'Retrieves all files that have been ingested into the system',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all ingested files',
    type: GetFilesResponseDto,
  })
  async getFiles(): Promise<GetFilesResponseDto> {
    const files = await this.fileIngestionService.getFiles();

    const response: GetFilesResponseDto = {
      files,
      count: files.length,
    };

    return response;
  }
}
