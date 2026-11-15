import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryItem,
  InventoryItemPhoto,
  InventoryMovement,
  InventoryRecognition,
  InventorySupplier,
  User,
} from '../database/entities';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventorySuppliersController } from './inventory-suppliers.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { MovementsService } from './movements.service';
import { S3ObjectReader } from './recognition/object-reader';
import {
  ClaudeRecognitionClient,
  RECOGNITION_CLIENT,
} from './recognition/recognition-client';
import { RecognitionService } from './recognition/recognition.service';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryItemPhoto,
      InventoryMovement,
      InventoryRecognition,
      InventorySupplier,
      User,
    ]),
  ],
  controllers: [
    InventoryCategoriesController,
    InventorySuppliersController,
    InventoryController,
  ],
  providers: [
    InventoryService,
    MovementsService,
    SuppliersService,
    { provide: RECOGNITION_CLIENT, useClass: ClaudeRecognitionClient },
    S3ObjectReader,
    RecognitionService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
