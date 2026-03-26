import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SellerApplicationStatus } from '../enums';
import { User } from './user.entity';

@Entity('seller_applications')
export class SellerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: SellerApplicationStatus,
    enumName: 'seller_application_status_enum',
    default: SellerApplicationStatus.PENDING,
  })
  status: SellerApplicationStatus;

  @Column({ type: 'text', name: 'shop_name' })
  shopName: string;

  @Column({ type: 'text', name: 'shop_address' })
  shopAddress: string;

  @Column({ type: 'text', name: 'shop_phone' })
  shopPhone: string;

  @Column({ type: 'text', name: 'logo_storage_key', nullable: true })
  logoStorageKey: string | null;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
