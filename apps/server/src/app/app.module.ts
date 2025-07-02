import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileIngestionModule } from './file-ingestion/file-ingestion.module';

@Module({
  imports: [FileIngestionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
