import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';

@Entity('request_photos')
export class RequestPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PartRequest, (r) => r.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: PartRequest;

  @Column({ type: 'text', name: 'storage_key' })
  storageKey: string;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
