import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { VIN_RE } from '../../vehicles/vin';

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
  @ValidateIf((o: { vin_text?: string | null }) => Boolean(o.vin_text))
  @Matches(VIN_RE, {
    message: 'vin_text must be a 17-character VIN (no I, O, Q)',
  })
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

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
}
