import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryItem,
  InventoryItemPhoto,
  InventoryRecognition,
  User,
} from '../database/entities';
import { InventoryCategoriesController } from './inventory-categories.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryItemPhoto,
      InventoryRecognition,
      User,
    ]),
  ],
  controllers: [InventoryCategoriesController],
  providers: [],
  exports: [],
})
export class InventoryModule {}
