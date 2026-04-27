import { ConfigService } from '@nestjs/config';
import { DevSmsSender } from './dev-sms.sender';
import { HttpWebhookSmsSender } from './http-webhook-sms.sender';
import type { SmsSender } from './sms-sender.interface';
import { TwilioSmsSender } from './twilio-sms.sender';

export function createSmsSender(config: ConfigService): SmsSender {
  const raw = (config.get<string>('SMS_PROVIDER') ?? 'dev')
    .toLowerCase()
    .trim();
  if (raw === 'twilio') {
    return new TwilioSmsSender(config);
  }
  if (raw === 'http') {
    return new HttpWebhookSmsSender(config);
  }
  return new DevSmsSender();
}
