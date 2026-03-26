import { PartialType } from '@nestjs/swagger';
import { CreateOfferDto } from './create-offer.dto';

export class PatchOfferDto extends PartialType(CreateOfferDto) {}
