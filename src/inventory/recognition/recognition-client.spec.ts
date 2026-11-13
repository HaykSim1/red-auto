import { ConfigService } from '@nestjs/config';
import { ClaudeRecognitionClient } from './recognition-client';
import { RecognitionResult } from './recognition.schema';

const VALID: RecognitionResult = {
  is_part: true,
  brand: 'Bosch',
  part_number: '0 986 494 527',
  barcode: null,
  name: 'Тормозные колодки',
  name_en: 'Brake pads',
  name_hy: null,
  category_key: 'car_parts.braking_systems.brake_pads_and_shoes',
  oem_numbers: [],
  fitments: [],
  fitment_note: null,
  condition: 'new',
  confidence: {
    brand: 0.9,
    part_number: 0.9,
    barcode: 0,
    name: 0.9,
    category_key: 0.9,
    fitments: 0,
  },
  needs_review: ['fitments'],
  notes_for_seller: null,
};

function response(stopReason: string, texts: string[]) {
  return {
    model: 'claude-opus-5-5',
    stop_reason: stopReason,
    content: [
      { type: 'server_tool_use', id: 'x', name: 'web_search', input: {} },
      ...texts.map((text) => ({ type: 'text', text })),
    ],
    usage: {
      input_tokens: 900,
      cache_creation_input_tokens: 2000,
      cache_read_input_tokens: 30000,
      output_tokens: 1500,
      server_tool_use: { web_search_requests: 4 },
    },
  };
}

describe('ClaudeRecognitionClient', () => {
  let create: jest.Mock;
  let client: ClaudeRecognitionClient;
  const input = {
    images: [{ media_type: 'image/png' as const, data: 'AAAA' }],
    hints: { barcode: '4047024063303', text: null },
  };
  const usage = { inputTokens: 32900, outputTokens: 1500, webSearchUses: 4 };

  beforeEach(() => {
    create = jest.fn();
    const config = {
      get: (k: string) => (k === 'ANTHROPIC_API_KEY' ? 'test-key' : undefined),
    } as unknown as ConfigService;
    client = new ClaudeRecognitionClient(config);
    (client as unknown as { sdk: unknown }).sdk = {
      beta: { messages: { create } },
    };
  });

  it('sends the spike request shape', async () => {
    create.mockResolvedValue(response('end_turn', [JSON.stringify(VALID)]));
    await client.recognize(input);
    const params = (create.mock.calls[0] as [Record<string, unknown>])[0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
      output_config: { effort: 'high' },
    });
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('tool_choice');
  });

  it('returns refusal with usage when the turn is declined with non-JSON text', async () => {
    create.mockResolvedValue(response('refusal', ['I cannot help with that.']));
    await expect(client.recognize(input)).resolves.toEqual({
      parsed: null,
      stopReason: 'refusal',
      usage,
      model: 'claude-opus-5-5',
    });
  });

  it('returns parsed null with usage when the text is not valid JSON or schema', async () => {
    create.mockResolvedValueOnce(response('end_turn', ['not json']));
    await expect(client.recognize(input)).resolves.toEqual({
      parsed: null,
      stopReason: 'end_turn',
      usage,
      model: 'claude-opus-5-5',
    });
    create.mockResolvedValueOnce(
      response('max_tokens', [JSON.stringify({ name: 'x' })]),
    );
    await expect(client.recognize(input)).resolves.toMatchObject({
      parsed: null,
      stopReason: 'max_tokens',
      usage,
    });
  });

  it('returns the parsed object for valid JSON, after any preamble text', async () => {
    create.mockResolvedValueOnce(response('end_turn', [JSON.stringify(VALID)]));
    await expect(client.recognize(input)).resolves.toEqual({
      parsed: VALID,
      stopReason: 'end_turn',
      usage,
      model: 'claude-opus-5-5',
    });
    create.mockResolvedValueOnce(
      response('end_turn', ['Let me look that up.', JSON.stringify(VALID)]),
    );
    await expect(client.recognize(input)).resolves.toMatchObject({
      parsed: VALID,
    });
  });
});
