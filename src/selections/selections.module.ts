import { Module, forwardRef } from '@nestjs/common';
import { OffersModule } from '../offers/offers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SelectionsController } from './selections.controller';
import { SelectionsService } from './selections.service';

@Module({
  imports: [forwardRef(() => OffersModule), RealtimeModule],
  controllers: [SelectionsController],
  providers: [SelectionsService],
  exports: [SelectionsService],
})
export class SelectionsModule {}
