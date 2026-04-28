import { IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CheckVersionQueryDto {
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  build: number;
}
