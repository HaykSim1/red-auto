import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ModerationState } from '../../database/enums';

export class PatchModerationDto {
  @ApiProperty({ enum: ModerationState })
  @IsEnum(ModerationState)
  moderation_state: ModerationState;
}
