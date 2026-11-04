import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RecognitionImage } from './object-reader';
import { buildSystemPrompt, buildUserText } from './recognition.prompt';
import { RecognitionResult, RecognitionSchema } from './recognition.schema';

export const RECOGNITION_CLIENT = Symbol('RECOGNITION_CLIENT');

export interface RecognitionInput {
  images: RecognitionImage[];
  hints: { barcode?: string | null; text?: string | null };
}

export interface RecognitionCallResult {
  parsed: RecognitionResult | null;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number; webSearchUses: number };
  model: string;
}

export interface RecognitionClient {
  isConfigured(): boolean;
  recognize(input: RecognitionInput): Promise<RecognitionCallResult>;
}

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/**
 * Validates the model's JSON against the schema. Returns null on any JSON or
 * schema failure. The last text block is tried first (web search can put
 * prose before the answer), then all text blocks joined.
 */
export function parseRecognitionText(
  content: BetaMessage['content'],
): RecognitionResult | null {
  const texts = content.flatMap((b) => (b.type === 'text' ? [b.text] : []));
  if (texts.length === 0) return null;
  const candidates = [texts[texts.length - 1]];
  if (texts.length > 1) candidates.push(texts.join(''));
  for (const text of candidates) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const res = RecognitionSchema.safeParse(json);
    if (res.success) return res.data;
  }
  return null;
}

@Injectable()
export class ClaudeRecognitionClient implements RecognitionClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private sdk: Anthropic | null = null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY') || undefined;
    this.model =
      config.get<string>('AI_RECOGNITION_MODEL') || 'claude-opus-5-5';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async recognize(input: RecognitionInput): Promise<RecognitionCallResult> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
    this.sdk ??= new Anthropic({
      apiKey: this.apiKey,
      timeout: 180_000,
      maxRetries: 1,
    });

    // `create` (not `parse`): the SDK's parse helper throws on non-JSON text
    // before stop_reason can be read, which would hide refusals and usage.
    const res = await this.sdk.beta.messages.create({
      model: this.model,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
      output_config: {
        effort: 'high',
        format: betaZodOutputFormat(RecognitionSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            ...input.images.map((img) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.media_type,
                data: img.data,
              },
            })),
            { type: 'text' as const, text: buildUserText(input.hints) },
          ],
        },
      ],
    });

    const stopReason = res.stop_reason ?? 'unknown';
    return {
      // Never trust output from a declined turn.
      parsed:
        stopReason === 'refusal' ? null : parseRecognitionText(res.content),
      stopReason,
      usage: {
        // Total input: uncached + cache writes + cache reads.
        inputTokens:
          res.usage.input_tokens +
          (res.usage.cache_creation_input_tokens ?? 0) +
          (res.usage.cache_read_input_tokens ?? 0),
        outputTokens: res.usage.output_tokens,
        webSearchUses: res.usage.server_tool_use?.web_search_requests ?? 0,
      },
      model: res.model,
    };
  }
}
