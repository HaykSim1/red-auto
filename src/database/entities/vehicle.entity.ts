import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('vehicles')
@Check(
  `("vin" IS NOT NULL AND btrim("vin") <> '') OR ("brand" IS NOT NULL AND "model" IS NOT NULL AND "year" IS NOT NULL)`,
)
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  model: string | null;

  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @Column({ type: 'text', nullable: true })
  engine: string | null;

  @Column({ type: 'text', nullable: true })
  vin: string | null;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
