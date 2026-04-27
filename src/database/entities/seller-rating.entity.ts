import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';
import { User } from './user.entity';

@Entity('seller_ratings')
export class SellerRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PartRequest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'request_id' })
  request: PartRequest | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rater_id' })
  rater: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ type: 'smallint' })
  score: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
