import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppVersionConfig } from '../database/entities/app-version-config.entity';

export type UpdateAction = 'none' | 'soft' | 'hard';

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersionConfig)
    private readonly configs: Repository<AppVersionConfig>,
  ) {}

  async check(
    platform: 'ios' | 'android',
    build: number,
  ): Promise<{ action: UpdateAction; store_url: string | null; latest_build: number }> {
    const config = await this.configs.findOne({ where: { platform } });

    if (!config) {
      return { action: 'none', store_url: null, latest_build: 0 };
    }

    let action: UpdateAction = 'none';

    if (config.forceUpdateEnabled && build < config.minBuild) {
      action = 'hard';
    } else if (build < config.latestBuild) {
      action = 'soft';
    }

    return {
      action,
      store_url: config.storeUrl,
      latest_build: config.latestBuild,
    };
  }

  async getAll(): Promise<AppVersionConfig[]> {
    return this.configs.find();
  }

  async patch(
    platform: 'ios' | 'android',
    updates: Partial<Pick<AppVersionConfig, 'minBuild' | 'latestBuild' | 'storeUrl' | 'forceUpdateEnabled'>>,
  ): Promise<AppVersionConfig> {
    let config = await this.configs.findOne({ where: { platform } });
    if (!config) {
      config = this.configs.create({ platform });
    }
    Object.assign(config, updates);
    return this.configs.save(config);
  }
}
