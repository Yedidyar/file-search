import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileIngestionController } from './controllers/file-ingestion.controller';
import { FileIngestionService } from './services/file-ingestion.service';

@Module({
  imports: [],
  controllers: [AppController, FileIngestionController],
  providers: [AppService, FileIngestionService],
})
export class AppModule {}
