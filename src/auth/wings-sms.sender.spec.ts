import { ConfigService } from '@nestjs/config';
import { WingsSmsSender } from './wings-sms.sender';

type FetchMock = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>;

interface WingsRequestBody {
  messages: Array<{
    recipient: string;
    'message-id': string;
    priority?: string;
    sms: {
      originator: string;
      ttl?: string;
      content: { text: string };
    };
  }>;
}

function makeConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const values: Record<string, string | undefined> = {
    SMS_WINGS_BASE_URL: 'https://smssend.nikita.am/broker-api',
    SMS_WINGS_USERNAME: 'user',
    SMS_WINGS_PASSWORD: 'pass',
    SMS_WINGS_ORIGINATOR: 'RedAuto',
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const v = values[key];
      if (v === undefined || v === '') {
        throw new Error(`Missing config: ${key}`);
      }
      return v;
    },
  } as unknown as ConfigService;
}

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve('OK'),
  } as Response;
}

describe('WingsSmsSender', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function sentBody(): WingsRequestBody {
    const init = fetchMock.mock.calls[0][1]!;
    return JSON.parse(init.body as string) as WingsRequestBody;
  }

  it('POSTs to <base-url>/send with Basic auth and JSON content type', async () => {
    const sender = new WingsSmsSender(makeConfig());
    await sender.sendOtp('+37499123456', '123456');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://smssend.nikita.am/broker-api/send');
    expect(init!.method).toBe('POST');
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('user:pass').toString('base64')}`,
    );
    expect(headers['Content-Type']).toBe('application/json; charset=utf-8');
  });

  it('tolerates a trailing slash on the base URL', async () => {
    const sender = new WingsSmsSender(
      makeConfig({
        SMS_WINGS_BASE_URL: 'https://smssend.nikita.am/broker-api/',
      }),
    );
    await sender.sendOtp('+37499123456', '123456');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://smssend.nikita.am/broker-api/send',
    );
  });

  it('builds the message: stripped +, originator, default template text', async () => {
    const sender = new WingsSmsSender(makeConfig());
    await sender.sendOtp('+37499123456', '123456');

    const body = sentBody();
    expect(body.messages).toHaveLength(1);
    const msg = body.messages[0];
    expect(msg.recipient).toBe('37499123456');
    expect(msg.sms.originator).toBe('RedAuto');
    expect(msg.sms.content.text).toBe('Red Auto code: 123456');
    expect(msg.priority).toBeUndefined();
    expect(msg.sms.ttl).toBeUndefined();
  });

  it('uses SMS_OTP_MESSAGE_TEMPLATE when set', async () => {
    const sender = new WingsSmsSender(
      makeConfig({ SMS_OTP_MESSAGE_TEMPLATE: 'Code {{code}} for {{phone}}' }),
    );
    await sender.sendOtp('+37499123456', '654321');
    expect(sentBody().messages[0].sms.content.text).toBe(
      'Code 654321 for +37499123456',
    );
  });

  it('includes priority and ttl only when configured', async () => {
    const sender = new WingsSmsSender(
      makeConfig({ SMS_WINGS_PRIORITY: '2', SMS_WINGS_TTL: '300' }),
    );
    await sender.sendOtp('+37499123456', '123456');
    const msg = sentBody().messages[0];
    expect(msg.priority).toBe('2');
    expect(msg.sms.ttl).toBe('300');
  });

  it('generates unique message-ids of at most 30 chars', async () => {
    const sender = new WingsSmsSender(makeConfig());
    await sender.sendOtp('+37499123456', '111111');
    await sender.sendOtp('+37499123456', '222222');

    const id1 = (
      JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as WingsRequestBody
    ).messages[0]['message-id'];
    const id2 = (
      JSON.parse(fetchMock.mock.calls[1][1]!.body as string) as WingsRequestBody
    ).messages[0]['message-id'];
    expect(id1.length).toBeGreaterThan(0);
    expect(id1.length).toBeLessThanOrEqual(30);
    expect(id2.length).toBeLessThanOrEqual(30);
    expect(id1).not.toBe(id2);
  });

  it('throws "SMS delivery failed" on non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          '{"error_code":"203","error_description":"Invalid recipient"}',
        ),
    } as Response);
    const sender = new WingsSmsSender(makeConfig());
    await expect(sender.sendOtp('+37499123456', '123456')).rejects.toThrow(
      'SMS delivery failed',
    );
  });
});
