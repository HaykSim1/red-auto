import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelAcceptedOfferDto {
  @ApiProperty({ description: 'Why the deal is cancelled' })
  @IsString()
  @MinLength(1)
  cancel_reason: string;
}
