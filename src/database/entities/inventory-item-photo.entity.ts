import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

@Entity('inventory_item_photos')
export class InventoryItemPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InventoryItem, (i) => i.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey: string;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
