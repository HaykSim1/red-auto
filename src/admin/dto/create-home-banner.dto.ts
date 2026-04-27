import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHomeBannerDto {
  @ApiProperty({ description: 'S3 key from presign (home_banners/…)' })
  @IsString()
  @MaxLength(512)
  storage_key: string;

  @ApiProperty({ description: 'Banner title (may be empty for image-only)' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subtitle?: string | null;
}
