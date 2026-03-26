import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '../../database/enums';

export class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  expo_push_token: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}
