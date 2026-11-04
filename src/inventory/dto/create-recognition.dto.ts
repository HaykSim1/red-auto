import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRecognitionDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 3,
    description: 'Storage keys from presign (purpose inventory_photo).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  photo_storage_keys: string[];

  @ApiPropertyOptional({ maxLength: 32, description: 'Scanned EAN/UPC.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  barcode_hint?: string;

  @ApiPropertyOptional({ maxLength: 500, description: 'Free-text hint.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text_hint?: string;
}
