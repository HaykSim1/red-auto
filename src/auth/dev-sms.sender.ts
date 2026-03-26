import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms-sender.interface';

@Injectable()
export class DevSmsSender implements SmsSender {
  private readonly logger = new Logger(DevSmsSender.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`);
  }
}
