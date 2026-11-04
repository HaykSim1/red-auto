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

/** Thrown by the SDK when the model's text is not valid schema JSON. */
const PARSE_ERROR_PREFIX = 'Failed to parse structured output';

@Injectable()
export class ClaudeRecognitionClient implements RecognitionClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private client: Anthropic | null = null;

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
    this.client ??= new Anthropic({
      apiKey: this.apiKey,
      timeout: 180_000,
      maxRetries: 1,
    });

    try {
      const res = await this.client.beta.messages.parse({
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
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
        ],
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
        // Never trust parsed output from a declined turn.
        parsed: stopReason === 'refusal' ? null : (res.parsed_output ?? null),
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
    } catch (err) {
      // The SDK throws (instead of returning null) when the text block is not
      // valid schema JSON; report that as a parse failure, not a transport error.
      if (
        err instanceof Anthropic.AnthropicError &&
        !(err instanceof Anthropic.APIError) &&
        err.message.startsWith(PARSE_ERROR_PREFIX)
      ) {
        return {
          parsed: null,
          stopReason: 'parse_error',
          usage: { inputTokens: 0, outputTokens: 0, webSearchUses: 0 },
          model: this.model,
        };
      }
      throw err;
    }
  }
}
