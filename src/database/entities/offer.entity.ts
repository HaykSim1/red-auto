import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  ModerationState,
  OfferCondition,
  OfferDelivery,
  OfferInteractionState,
} from '../enums';
import { OfferPhoto } from './offer-photo.entity';
import { PartRequest } from './part-request.entity';
import { User } from './user.entity';

@Entity('offers')
@Unique('UQ_offers_request_seller', ['request', 'seller'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PartRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: PartRequest;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'price_amount' })
  priceAmount: string;

  @Column({ type: 'char', length: 3, name: 'price_currency', default: 'AMD' })
  priceCurrency: string;

  @Column({
    type: 'enum',
    enum: OfferCondition,
    enumName: 'offer_condition_enum',
  })
  condition: OfferCondition;

  @Column({
    type: 'enum',
    enum: OfferDelivery,
    enumName: 'offer_delivery_enum',
  })
  delivery: OfferDelivery;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ModerationState,
    enumName: 'moderation_state_enum',
    name: 'moderation_state',
    default: ModerationState.VISIBLE,
  })
  moderationState: ModerationState;

  @Column({
    type: 'enum',
    enum: OfferInteractionState,
    enumName: 'offer_interaction_state_enum',
    name: 'interaction_state',
    default: OfferInteractionState.NONE,
  })
  interactionState: OfferInteractionState;

  @Column({ type: 'timestamptz', name: 'buyer_accepted_at', nullable: true })
  buyerAcceptedAt: Date | null;

  @Column({ type: 'text', name: 'buyer_cancel_reason', nullable: true })
  buyerCancelReason: string | null;

  @Column({ type: 'timestamptz', name: 'buyer_cancelled_at', nullable: true })
  buyerCancelledAt: Date | null;

  @Column({ type: 'timestamptz', name: 'seller_acknowledged_at', nullable: true })
  sellerAcknowledgedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'buyer_deal_complete_at', nullable: true })
  buyerDealCompleteAt: Date | null;

  @Column({ type: 'timestamptz', name: 'seller_deal_complete_at', nullable: true })
  sellerDealCompleteAt: Date | null;

  @Column({ type: 'text', name: 'buyer_deal_cancel_reason', nullable: true })
  buyerDealCancelReason: string | null;

  @Column({ type: 'timestamptz', name: 'buyer_deal_cancel_at', nullable: true })
  buyerDealCancelAt: Date | null;

  @Column({ type: 'text', name: 'seller_deal_cancel_reason', nullable: true })
  sellerDealCancelReason: string | null;

  @Column({ type: 'timestamptz', name: 'seller_deal_cancel_at', nullable: true })
  sellerDealCancelAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OfferPhoto, (p) => p.offer)
  photos: OfferPhoto[];
}
