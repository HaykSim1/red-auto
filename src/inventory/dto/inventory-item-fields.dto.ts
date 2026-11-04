import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OfferCondition } from '../../database/enums';
import { FitmentDto } from './fitment.dto';
import { OptionalNotNull } from './optional-not-null';

export class InventoryItemFieldsDto {
  @ApiPropertyOptional({ enum: ['draft', 'active'], default: 'active' })
  @OptionalNotNull()
  @IsIn(['draft', 'active'])
  status?: 'draft' | 'active';

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  part_number?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  barcode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_hy?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name_en?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category_key?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  oem_numbers?: string[];

  @ApiPropertyOptional({ type: [FitmentDto] })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FitmentDto)
  fitments?: FitmentDto[];

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fitment_note?: string | null;

  @ApiPropertyOptional({ enum: OfferCondition })
  @OptionalNotNull()
  @IsEnum(OfferCondition)
  condition?: OfferCondition;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 9_999_999_999,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  price_amount?: number | null;

  @ApiPropertyOptional({ default: 1, minimum: 0 })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shelf_location?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  photo_storage_keys?: string[];
}
