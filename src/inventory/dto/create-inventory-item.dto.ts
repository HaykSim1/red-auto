import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InventoryItemFieldsDto } from './inventory-item-fields.dto';

export class CreateInventoryItemDto extends InventoryItemFieldsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  recognition_id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;
}
