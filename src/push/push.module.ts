import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../database/entities/device.entity';
import { PushService } from './push.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
