import { PartialType } from '@nestjs/swagger';
import { CreateManagedShopDto } from './create-managed-shop.dto';

export class PatchManagedShopDto extends PartialType(CreateManagedShopDto) {}
