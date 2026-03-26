import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PreferredLocale } from '../../database/enums';

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string | null;

  @ApiPropertyOptional({ enum: PreferredLocale })
  @IsOptional()
  @IsEnum(PreferredLocale)
  preferred_locale?: PreferredLocale | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  seller_phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  seller_telegram?: string | null;

  /** Sellers only; use `null` to clear the logo key. */
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  shop_name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shop_address?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(512)
  shop_logo_storage_key?: string | null;
}
