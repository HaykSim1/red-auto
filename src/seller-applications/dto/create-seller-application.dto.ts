import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateSellerApplicationDto {
  @ApiProperty({ example: 'Auto Parts LLC' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  shop_name: string;

  @ApiProperty({ example: 'Yerevan, Armenia' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shop_address: string;

  @ApiProperty({
    example: '+37494123456',
    description: 'Shop contact phone (E.164 Armenia). May differ from login phone.',
  })
  @IsString()
  @Matches(/^\+374\d{8}$/, {
    message: 'shop_phone must be E.164 Armenia (+374 followed by 8 digits)',
  })
  shop_phone: string;

  @ApiPropertyOptional({ description: 'S3 storage key from POST /uploads/presign (shop_logo)' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logo_storage_key?: string | null;
}
