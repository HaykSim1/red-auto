import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('seller_rating_aggregate')
export class SellerRatingAggregate {
  @PrimaryColumn('uuid', { name: 'seller_id' })
  sellerId: string;

  @Column({ type: 'decimal', precision: 4, scale: 3, name: 'avg_score' })
  avgScore: string;

  @Column({ type: 'int', name: 'rating_count' })
  ratingCount: number;
}
