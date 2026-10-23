import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { VIN_RE } from '../../vehicles/vin';
import { PartRequestStatus } from '../../database/enums';

export const MAX_REQUEST_PHOTOS = 10;

/**
 * Author edits. Content fields are accepted only while the request is open, visible and has no
 * active accepted offer; `status` may only move open → cancelled. The vehicle is never editable.
 */
export class PatchRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @ValidateIf((o: { vin_text?: string | null }) => Boolean(o.vin_text))
  @Matches(VIN_RE, {
    message: 'vin_text must be a 17-character VIN (no I, O, Q)',
  })
  vin_text?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  part_number?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Full replacement of the photo set, in display order. An empty array removes all photos.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUEST_PHOTOS)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  photo_storage_keys?: string[];

  @ApiPropertyOptional({ enum: PartRequestStatus })
  @IsOptional()
  @IsEnum(PartRequestStatus)
  status?: PartRequestStatus;
}
