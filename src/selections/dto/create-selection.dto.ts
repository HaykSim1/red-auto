import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateSelectionDto {
  @ApiProperty()
  @IsUUID()
  offer_id: string;
}
