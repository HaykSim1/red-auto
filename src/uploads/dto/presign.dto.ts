import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export enum UploadPurpose {
  REQUEST_PHOTO = 'request_photo',
  OFFER_PHOTO = 'offer_photo',
  SHOP_LOGO = 'shop_logo',
}

export class PresignDto {
  @ApiProperty({ enum: UploadPurpose })
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(120)
  content_type: string;

  @ApiProperty({ example: 2_000_000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  size: number;
}
