import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PartCategoryGroupDto } from '../common/dto/responses.dto';
import { PART_CATEGORIES } from './catalog/part-categories';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryCategoriesController {
  @Public()
  @Get('categories')
  @ApiOperation({
    summary: 'Part category taxonomy (groups with leaf categories)',
  })
  @ApiOkResponse({ type: [PartCategoryGroupDto] })
  categories(): PartCategoryGroupDto[] {
    return PART_CATEGORIES.map((g) => ({
      ...g,
      children: g.children.map((c) => ({ ...c })),
    }));
  }
}
