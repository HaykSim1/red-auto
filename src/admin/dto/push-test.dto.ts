import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PushTestDto {
  @ApiPropertyOptional({
    description: 'User id to target; defaults to the authenticated admin',
  })
  @IsOptional()
  @IsUUID('4')
  user_id?: string;
}
