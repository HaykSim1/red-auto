import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PartCategoryNodeDto } from '../common/dto/responses.dto';
import { PART_CATEGORIES, PartCategoryNode } from './catalog/part-categories';

function toDto(n: PartCategoryNode): PartCategoryNodeDto {
  return {
    key: n.key,
    labels: { ...n.labels },
    children: n.children.map(toDto),
  };
}

@ApiTags('inventory')
@Controller('inventory')
export class InventoryCategoriesController {
  @Public()
  @Get('categories')
  @ApiOperation({
    summary:
      'Part category taxonomy: sections → groups → leaves (a node without children is a leaf)',
  })
  @ApiOkResponse({ type: [PartCategoryNodeDto] })
  categories(): PartCategoryNodeDto[] {
    return PART_CATEGORIES.map(toDto);
  }
}
