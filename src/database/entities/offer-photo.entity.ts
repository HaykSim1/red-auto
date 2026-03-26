import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Offer } from './offer.entity';

@Entity('offer_photos')
export class OfferPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Offer, (o) => o.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey: string;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
