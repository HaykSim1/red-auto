import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  vin_text?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  part_number?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Storage keys from presigned upload flow',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photo_storage_keys?: string[];
}
