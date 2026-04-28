import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAppVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  min_build?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force_update_enabled?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  store_url?: string | null;
}
