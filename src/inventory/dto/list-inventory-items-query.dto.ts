import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ShopCatalogQueryDto } from './shop-catalog-query.dto';

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
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  in_stock?: boolean;
}
