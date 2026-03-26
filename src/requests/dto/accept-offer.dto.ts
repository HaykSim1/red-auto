import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AcceptOfferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  offer_id: string;
}
