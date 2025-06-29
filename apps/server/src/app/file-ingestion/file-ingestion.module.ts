import { Module } from '@nestjs/common';
import { FileIngestionController } from './file-ingestion.controller';
import { FileIngestionService } from './file-ingestion.service';
import { databaseProviders } from '../../db/database.provider';

@Module({
  imports: [],
  controllers: [FileIngestionController],
  providers: [FileIngestionService, ...databaseProviders],
})
export class FileIngestionModule {}
