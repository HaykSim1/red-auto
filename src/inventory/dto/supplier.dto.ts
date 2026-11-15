import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OptionalNotNull } from './optional-not-null';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class SupplierFieldsDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Telegram username or link.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegram?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class CreateSupplierDto extends SupplierFieldsDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

export class UpdateSupplierDto extends SupplierFieldsDto {
  @ApiPropertyOptional()
  @OptionalNotNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
}
