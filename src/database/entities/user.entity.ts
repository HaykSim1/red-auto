import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PreferredLocale, UserRole } from '../enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'timestamptz', name: 'blocked_at', nullable: true })
  blockedAt: Date | null;

  @Column({ type: 'text', name: 'display_name', nullable: true })
  displayName: string | null;

  @Column({
    type: 'enum',
    enum: PreferredLocale,
    enumName: 'preferred_locale_enum',
    name: 'preferred_locale',
    nullable: true,
  })
  preferredLocale: PreferredLocale | null;

  @Column({ type: 'text', name: 'seller_phone', nullable: true })
  sellerPhone: string | null;

  @Column({ type: 'text', name: 'seller_telegram', nullable: true })
  sellerTelegram: string | null;

  @Column({ type: 'text', name: 'shop_name', nullable: true })
  shopName: string | null;

  @Column({ type: 'text', name: 'shop_address', nullable: true })
  shopAddress: string | null;

  @Column({ type: 'text', name: 'shop_logo_storage_key', nullable: true })
  shopLogoStorageKey: string | null;

  @Column({ type: 'text', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'text', name: 'password_hash', nullable: true })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
