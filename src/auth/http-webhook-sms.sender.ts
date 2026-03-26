import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsSender } from './sms-sender.interface';

function formatOtpMessage(template: string, phone: string, code: string): string {
  return template.replace(/\{\{phone\}\}/g, phone).replace(/\{\{code\}\}/g, code);
}

/** Escape for use inside JSON string literals (between quotes in template). */
function jsonStringChunk(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

/**
 * POST JSON to an aggregator URL. Default body template:
 * `{"to":"{{phone}}","message":"{{message}}"}` where `message` is the OTP text.
 */
export class HttpWebhookSmsSender implements SmsSender {
  private readonly logger = new Logger(HttpWebhookSmsSender.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const url = this.config.getOrThrow<string>('SMS_HTTP_URL').trim();
    const msgTemplate =
      this.config.get<string>('SMS_OTP_MESSAGE_TEMPLATE') ??
      'Zapchast code: {{code}}';
    const message = formatOtpMessage(msgTemplate, phone, code);

    const bodyTemplate =
      this.config.get<string>('SMS_HTTP_BODY_JSON') ??
      '{"to":"{{phone}}","message":"{{message}}"}';

    const bodyJson = bodyTemplate
      .replace(/\{\{phone\}\}/g, jsonStringChunk(phone))
      .replace(/\{\{message\}\}/g, jsonStringChunk(message))
      .replace(/\{\{code\}\}/g, jsonStringChunk(code));

    try {
      JSON.parse(bodyJson);
    } catch {
      throw new Error(
        'SMS_HTTP_BODY_JSON must produce valid JSON after placeholder substitution',
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const headersJson = this.config.get<string>('SMS_HTTP_HEADERS_JSON')?.trim();
    if (headersJson) {
      try {
        Object.assign(headers, JSON.parse(headersJson) as Record<string, string>);
      } catch {
        throw new Error('SMS_HTTP_HEADERS_JSON must be valid JSON object');
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyJson,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`HTTP SMS webhook failed ${res.status}: ${text}`);
      throw new Error('SMS delivery failed');
    }
  }
}
