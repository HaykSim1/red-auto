import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from '../config/env.schema';
import { typeOrmEntities } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [...typeOrmEntities],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        /** Avoid LIMIT breaking one-to-many joins on paginated list queries (photos per request). */
        relationLoadStrategy: 'query' as const,
      }),
    }),
  ],
})
export class DatabaseModule {}
