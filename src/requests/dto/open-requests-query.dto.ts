import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const MAX_FILTER_VALUES = 10;

/** `?brand=BMW&brand=Audi`, `?brand=BMW,Audi` and `?brand[]=BMW` all become `['BMW', 'Audi']`. */
export function toStringList({
  value,
}: {
  value: unknown;
}): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const out = raw
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? [...new Set(out)] : undefined;
}

/** Seller feed filters. The cursor is only valid for the same filter set — reset it when filters change. */
export class OpenRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Vehicle brand(s), case-insensitive exact match. Repeat the param or pass CSV. Requests without a vehicle are excluded when set.',
  })
  @IsOptional()
  @Transform(toStringList)
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  brand?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'City key(s), exact match (e.g. `yerevan`). Repeat the param or pass CSV.',
  })
  @IsOptional()
  @Transform(toStringList)
  @IsArray()
  @ArrayMaxSize(MAX_FILTER_VALUES)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  city?: string[];
}
