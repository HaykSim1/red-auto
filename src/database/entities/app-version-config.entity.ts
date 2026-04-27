import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppPlatform = 'ios' | 'android';

@Entity('app_version_config')
export class AppVersionConfig {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  platform: AppPlatform;

  /** Minimum build number required to use the app. Builds below this get a hard update (if force_update_enabled). */
  @Column({ type: 'int', default: 0, name: 'min_build' })
  minBuild: number;

  /** Latest available build number. Builds below this get a soft update suggestion. */
  @Column({ type: 'int', default: 0, name: 'latest_build' })
  latestBuild: number;

  /** App Store / Play Store URL. */
  @Column({ type: 'text', nullable: true, name: 'store_url' })
  storeUrl: string | null;

  /** Master toggle for hard updates. When false, no hard update is ever shown. */
  @Column({ type: 'boolean', default: false, name: 'force_update_enabled' })
  forceUpdateEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
