import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetSpecialBuyerDto {
  @ApiProperty()
  @IsBoolean()
  is_special_buyer: boolean;
}
