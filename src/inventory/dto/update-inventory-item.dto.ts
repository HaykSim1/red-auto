import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { InventoryItemFieldsDto } from './inventory-item-fields.dto';
import { OptionalNotNull } from './optional-not-null';

export class UpdateInventoryItemDto extends InventoryItemFieldsDto {
  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}
