import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryItemStatus, OfferCondition } from '../enums';
import { InventoryItemPhoto } from './inventory-item-photo.entity';
import { InventoryRecognition } from './inventory-recognition.entity';
import { User } from './user.entity';

export interface InventoryFitment {
  make: string;
  model: string | null;
  year_from: number | null;
  year_to: number | null;
  engine: string | null;
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: User;

  @Column({
    type: 'enum',
    enum: InventoryItemStatus,
    enumName: 'inventory_item_status_enum',
    default: InventoryItemStatus.DRAFT,
  })
  status: InventoryItemStatus;

  @Column({ type: 'text', nullable: true })
  brand: string | null;

  @Column({ type: 'text', name: 'part_number', nullable: true })
  partNumber: string | null;

  @Column({ type: 'text', name: 'part_number_normalized', nullable: true })
  partNumberNormalized: string | null;

  @Column({ type: 'text', nullable: true })
  barcode: string | null;

  @Column({ type: 'text', array: true, name: 'oem_numbers', default: '{}' })
  oemNumbers: string[];

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', name: 'name_hy', nullable: true })
  nameHy: string | null;

  @Column({ type: 'text', name: 'name_en', nullable: true })
  nameEn: string | null;

  @Column({ type: 'text', name: 'category_key', nullable: true })
  categoryKey: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  fitments: InventoryFitment[];

  @Column({ type: 'text', name: 'fitment_note', nullable: true })
  fitmentNote: string | null;

  @Column({
    type: 'enum',
    enum: OfferCondition,
    enumName: 'offer_condition_enum',
    default: OfferCondition.NEW,
  })
  condition: OfferCondition;

  /** numeric(12,2) comes back from pg as a string. Null = price on request. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'price_amount',
    nullable: true,
  })
  priceAmount: string | null;

  @Column({ type: 'text', name: 'price_currency', default: 'AMD' })
  priceCurrency: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'text', name: 'shelf_location', nullable: true })
  shelfLocation: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', name: 'ai_confidence', nullable: true })
  aiConfidence: Record<string, number> | null;

  @Column({ type: 'text', array: true, name: 'needs_review', default: '{}' })
  needsReview: string[];

  @ManyToOne(() => InventoryRecognition, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'recognition_id' })
  recognition: InventoryRecognition | null;

  @OneToMany(() => InventoryItemPhoto, (p) => p.item)
  photos: InventoryItemPhoto[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
