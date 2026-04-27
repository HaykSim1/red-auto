import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsSender } from './sms-sender.interface';

function formatOtpMessage(
  template: string,
  phone: string,
  code: string,
): string {
  return template
    .replace(/\{\{phone\}\}/g, phone)
    .replace(/\{\{code\}\}/g, code);
}

export class TwilioSmsSender implements SmsSender {
  private readonly logger = new Logger(TwilioSmsSender.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    const messagingServiceSid = this.config
      .get<string>('TWILIO_MESSAGING_SERVICE_SID')
      ?.trim();
    const fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER')?.trim();
    if (!messagingServiceSid && !fromNumber) {
      throw new Error(
        'Twilio SMS: set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER',
      );
    }

    const template =
      this.config.get<string>('SMS_OTP_MESSAGE_TEMPLATE') ??
      'Red Auto code: {{code}}';
    const body = formatOtpMessage(template, phone, code);

    const params = new URLSearchParams();
    params.set('To', phone);
    params.set('Body', body);
    if (messagingServiceSid) {
      params.set('MessagingServiceSid', messagingServiceSid);
    } else {
      params.set('From', fromNumber!);
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Twilio SMS failed ${res.status}: ${text}`);
      throw new Error('SMS delivery failed');
    }
  }
}
