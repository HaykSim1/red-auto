import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppVersionConfig } from '../database/entities/app-version-config.entity';

export type UpdateAction = 'none' | 'hard';

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersionConfig)
    private readonly configs: Repository<AppVersionConfig>,
  ) {}

  async check(
    platform: 'ios' | 'android',
    build: number,
  ): Promise<{ action: UpdateAction; store_url: string | null }> {
    const config = await this.configs.findOne({ where: { platform } });

    if (!config) {
      return { action: 'none', store_url: null };
    }

    const action: UpdateAction =
      config.forceUpdateEnabled && build < config.minBuild ? 'hard' : 'none';

    return { action, store_url: config.storeUrl };
  }
}
