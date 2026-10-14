import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Admin creates a seller persona operated by staff (no OTP login, no application). */
export class CreateManagedShopDto {
  @ApiProperty({
    example: '+37494123456',
    description:
      'Shop phone (E.164 Armenia). Becomes both the account phone and the public contact; must be unique.',
  })
  @IsString()
  @Matches(/^\+374\d{8}$/, {
    message: 'phone must be E.164 Armenia (+374 followed by 8 digits)',
  })
  phone: string;

  @ApiProperty({ example: 'Garage One' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  shop_name: string;

  @ApiProperty({ example: 'Yerevan, Komitas 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shop_address: string;

  @ApiPropertyOptional({ example: '@garageone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  seller_telegram?: string | null;

  @ApiPropertyOptional({
    description: 'S3 storage key from POST /uploads/presign (shop_logo)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logo_storage_key?: string | null;
}
