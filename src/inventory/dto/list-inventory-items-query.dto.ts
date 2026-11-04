import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ShopCatalogQueryDto } from './shop-catalog-query.dto';

// Reads the raw value: with enableImplicitConversion the string "false" is
// already coerced to true (Boolean("false")) before @Transform sees `value`.
function parseBool(raw: unknown): unknown {
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return raw; // unrecognised values reach @IsBoolean and yield a 400
}

export class ListInventoryItemsQueryDto extends ShopCatalogQueryDto {
  @ApiPropertyOptional({
    enum: ['draft', 'active', 'all'],
    default: 'all',
    description: "'all' = draft + active (archived never listed).",
  })
  @IsOptional()
  @IsIn(['draft', 'active', 'all'])
  status?: 'draft' | 'active' | 'all';

  @ApiPropertyOptional({ description: 'true = quantity > 0, false = 0.' })
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseBool(obj[key]),
  )
  @IsBoolean()
  in_stock?: boolean;
}
