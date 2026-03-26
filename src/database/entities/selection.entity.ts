import { Column, Entity, PrimaryColumn } from 'typeorm';

/** PK and FKs match migration; relations added when SelectionService is implemented. */
@Entity('selections')
export class Selection {
  @PrimaryColumn('uuid', { name: 'request_id' })
  requestId: string;

  @Column('uuid', { name: 'chosen_offer_id' })
  chosenOfferId: string;

  @Column({ type: 'timestamptz', name: 'selected_at' })
  selectedAt: Date;
}
