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
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
