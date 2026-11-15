import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryMovementType } from '../enums';
import { InventoryItem } from './inventory-item.entity';
import { User } from './user.entity';

@Entity('inventory_movements')
@Index('IDX_inventory_movements_item_created', ['item', 'createdAt', 'id'])
@Index('IDX_inventory_movements_shop_created', ['shop', 'createdAt', 'id'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: User;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({
    type: 'enum',
    enum: InventoryMovementType,
    enumName: 'inventory_movement_type_enum',
  })
  type: InventoryMovementType;

  /** Signed change of stock; never 0. */
  @Column({ type: 'int' })
  delta: number;

  /** Item stock right after this movement. */
  @Column({ type: 'int', name: 'quantity_after' })
  quantityAfter: number;

  /** numeric(12,2) comes back from pg as a string. Only set on `receive`. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  /**
   * Millisecond precision on purpose: the list cursor carries a JS Date, and
   * a microsecond column would make `created_at = :cursor` never match.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
