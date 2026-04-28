import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModerationState, PartRequestStatus } from '../enums';
import { Offer } from './offer.entity';
import { RequestPhoto } from './request-photo.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

@Entity('part_requests')
export class PartRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', name: 'vin_text', nullable: true })
  vinText: string | null;

  @Column({ type: 'text', name: 'part_number', nullable: true })
  partNumber: string | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    type: 'enum',
    enum: PartRequestStatus,
    enumName: 'part_request_status_enum',
    default: PartRequestStatus.OPEN,
  })
  status: PartRequestStatus;

  @Column({ type: 'text', default: 'AM' })
  region: string;

  @Column({
    type: 'enum',
    enum: ModerationState,
    enumName: 'moderation_state_enum',
    default: ModerationState.VISIBLE,
    name: 'moderation_state',
  })
  moderationState: ModerationState;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RequestPhoto, (p) => p.request)
  photos: RequestPhoto[];

  /** Buyer accepted this offer: contact visible until deal completed or cancelled. */
  @ManyToOne(() => Offer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'active_acceptance_offer_id' })
  activeAcceptanceOffer: Offer | null;
}
