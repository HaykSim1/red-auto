import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type AppPlatform = 'ios' | 'android';

@Entity('app_version_config')
export class AppVersionConfig {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  platform: AppPlatform;

  @Column({ type: 'int', default: 0, name: 'min_build' })
  minBuild: number;

  @Column({ type: 'text', nullable: true, name: 'store_url' })
  storeUrl: string | null;

  @Column({ type: 'boolean', default: false, name: 'force_update_enabled' })
  forceUpdateEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
