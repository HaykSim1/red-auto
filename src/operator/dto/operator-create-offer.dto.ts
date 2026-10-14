import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateOfferDto } from '../../offers/dto/create-offer.dto';

/** Operator submits an offer on behalf of a managed shop persona. */
export class OperatorCreateOfferDto extends CreateOfferDto {
  @ApiProperty({ description: 'Managed shop (persona) the offer is posted as' })
  @IsUUID()
  shop_id: string;
}
