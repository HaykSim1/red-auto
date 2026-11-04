import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ShopCatalogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search name, brand, part no., barcode.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Leaf category key or group key.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;
}
