import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum MineListScope {
  ACTIVE = 'active',
  HISTORY = 'history',
}

export class MineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: MineListScope,
    default: MineListScope.ACTIVE,
    description:
      '`active`: open requests only. `history`: closed and cancelled.',
  })
  @IsOptional()
  @IsEnum(MineListScope)
  scope?: MineListScope = MineListScope.ACTIVE;
}
