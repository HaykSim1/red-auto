import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryItem,
  InventoryItemPhoto,
  InventoryRecognition,
  User,
} from '../database/entities';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { S3ObjectReader } from './recognition/object-reader';
import {
  ClaudeRecognitionClient,
  RECOGNITION_CLIENT,
} from './recognition/recognition-client';
import { RecognitionService } from './recognition/recognition.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryItemPhoto,
      InventoryRecognition,
      User,
    ]),
  ],
  controllers: [InventoryCategoriesController, InventoryController],
  providers: [
    InventoryService,
    { provide: RECOGNITION_CLIENT, useClass: ClaudeRecognitionClient },
    S3ObjectReader,
    RecognitionService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
