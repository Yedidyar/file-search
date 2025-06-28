import { Module } from '@nestjs/common';
import { FileIngestionController } from './file-ingestion.controller';
import { FileIngestionService } from './file-ingestion.service';

@Module({
  imports: [],
  controllers: [FileIngestionController],
  providers: [FileIngestionService],
})
export class FileIngestionModule {}
