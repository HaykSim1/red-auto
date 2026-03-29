import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OfferCondition, OfferDelivery } from '../../database/enums';

export class CreateOfferDto {
  @ApiProperty({ example: 125000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_amount: number;

  @ApiPropertyOptional({ default: 'AMD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  price_currency?: string;

  @ApiProperty({ enum: OfferCondition })
  @IsEnum(OfferCondition)
  condition: OfferCondition;

  @ApiProperty({ enum: OfferDelivery })
  @IsEnum(OfferDelivery)
  delivery: OfferDelivery;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  description: string;

  @ApiPropertyOptional({
    description: 'Optional brand / supplier label (e.g. Bosch, OEM)',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  variant_label?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photo_storage_keys?: string[];
}
