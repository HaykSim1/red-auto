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

/** Broker limit: message-id must be unique, max 30 chars. */
function generateMessageId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}`;
}

/**
 * WINGS Broker API (Nikita mobile) — Basic auth, POST <base-url>/send.
 * SMS channel only; fire-and-forget (no /getStatus polling).
 * See docs/superpowers/specs/2026-07-05-wings-sms-provider-design.md.
 */
export class WingsSmsSender implements SmsSender {
  private readonly logger = new Logger(WingsSmsSender.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const baseUrl = this.config
      .getOrThrow<string>('SMS_WINGS_BASE_URL')
      .trim()
      .replace(/\/+$/, '');
    const username = this.config.getOrThrow<string>('SMS_WINGS_USERNAME');
    const password = this.config.getOrThrow<string>('SMS_WINGS_PASSWORD');
    const originator = this.config.getOrThrow<string>('SMS_WINGS_ORIGINATOR');
    const priority = this.config.get<string>('SMS_WINGS_PRIORITY')?.trim();
    // env schema coerces SMS_WINGS_TTL to number — stringify before trimming
    const ttlRaw = this.config.get<string | number>('SMS_WINGS_TTL');
    const ttl =
      ttlRaw === undefined || ttlRaw === null
        ? undefined
        : String(ttlRaw).trim();

    const template =
      this.config.get<string>('SMS_OTP_MESSAGE_TEMPLATE') ??
      'Red Auto code: {{code}}';
    const text = formatOtpMessage(template, phone, code);

    const sms: Record<string, unknown> = {
      originator,
      content: { text },
    };
    if (ttl) {
      sms.ttl = ttl;
    }
    const message: Record<string, unknown> = {
      recipient: phone.replace(/^\+/, ''),
      'message-id': generateMessageId(),
      sms,
    };
    if (priority) {
      message.priority = priority;
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const res = await fetch(`${baseUrl}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ messages: [message] }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`WINGS SMS failed ${res.status}: ${body}`);
      throw new Error('SMS delivery failed');
    }
  }
}
