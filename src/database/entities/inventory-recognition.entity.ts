import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { RecognitionResult } from '../../inventory/recognition/recognition.schema';
import { InventoryRecognitionStatus } from '../enums';
import { User } from './user.entity';

@Entity('inventory_recognitions')
export class InventoryRecognition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: User;

  @Column({
    type: 'enum',
    enum: InventoryRecognitionStatus,
    enumName: 'inventory_recognition_status_enum',
    default: InventoryRecognitionStatus.PENDING,
  })
  status: InventoryRecognitionStatus;

  @Column({
    type: 'text',
    array: true,
    name: 'photo_storage_keys',
    default: '{}',
  })
  photoStorageKeys: string[];

  @Column({ type: 'text', name: 'barcode_hint', nullable: true })
  barcodeHint: string | null;

  @Column({ type: 'text', name: 'text_hint', nullable: true })
  textHint: string | null;

  /** Validated, post-processed structured output of the model. */
  @Column({ type: 'jsonb', nullable: true })
  result: RecognitionResult | null;

  /** Plain uuid (no FK) to avoid a circular reference with inventory_items. */
  @Column({ type: 'uuid', name: 'possible_duplicate_item_id', nullable: true })
  possibleDuplicateItemId: string | null;

  @Column({ type: 'text', name: 'error_code', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'text', nullable: true })
  model: string | null;

  @Column({ type: 'int', name: 'input_tokens', nullable: true })
  inputTokens: number | null;

  @Column({ type: 'int', name: 'output_tokens', nullable: true })
  outputTokens: number | null;

  @Column({ type: 'int', name: 'web_search_uses', nullable: true })
  webSearchUses: number | null;

  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date | null;
}
