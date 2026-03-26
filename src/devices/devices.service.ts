import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Device } from '../database/entities/device.entity';
import { User } from '../database/entities/user.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
  ) {}

  async register(userId: string, dto: RegisterDeviceDto) {
    const row = this.devices.create({
      user: { id: userId } as User,
      expoPushToken: dto.expo_push_token.trim(),
      platform: dto.platform,
    });
    const saved = await this.devices.save(row);
    return {
      id: saved.id,
      expo_push_token: saved.expoPushToken,
      platform: saved.platform,
      created_at: saved.createdAt.toISOString(),
    };
  }

  async remove(userId: string, deviceId: string): Promise<void> {
    const d = await this.devices.findOne({
      where: { id: deviceId, user: { id: userId } },
    });
    if (!d) {
      throw new ApiException(
        'not_found',
        'Device not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.devices.remove(d);
  }
}
