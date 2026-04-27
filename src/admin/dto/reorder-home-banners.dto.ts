import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderHomeBannersDto {
  @ApiProperty({
    type: [String],
    description: 'All banner ids in display order',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  ordered_ids: string[];
}
