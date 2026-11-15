import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InventoryMovementType } from '../../database/enums';

const MAX_QUANTITY = 1_000_000;
const MAX_MONEY = 9_999_999_999;

/** Movement types a scan can produce: `adjust` needs a deliberate number. */
export const BY_CODE_MOVEMENT_TYPES = [
  InventoryMovementType.SELL,
  InventoryMovementType.RECEIVE,
  InventoryMovementType.WRITE_OFF,
  InventoryMovementType.RETURN,
] as const;

class MovementExtrasDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    description: 'Purchase cost per unit. Only used on `receive`.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  unit_cost?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class CreateMovementDto extends MovementExtrasDto {
  @ApiProperty({ enum: InventoryMovementType })
  @IsEnum(InventoryMovementType)
  type: InventoryMovementType;

  @ApiProperty({
    minimum: 0,
    description:
      'Amount moved (>= 1) for receive / sell / write_off / return. For `adjust`: the new stock level (>= 0).',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity: number;
}

export class CreateMovementByCodeDto extends MovementExtrasDto {
  @ApiProperty({ description: 'Scanned barcode, or a typed part number.' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code: string;

  @ApiProperty({ enum: BY_CODE_MOVEMENT_TYPES })
  @IsIn(BY_CODE_MOVEMENT_TYPES)
  type: (typeof BY_CODE_MOVEMENT_TYPES)[number];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity?: number;
}

export class UpdateMovementDto {
  @ApiProperty({
    minimum: 0,
    description: 'Same meaning as on create, for the movement type.',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity: number;
}

export class LookupItemsQueryDto {
  @ApiProperty({ description: 'Scanned barcode, or a typed part number.' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code: string;
}
