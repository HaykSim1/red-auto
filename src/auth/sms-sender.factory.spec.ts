import { ConfigService } from '@nestjs/config';
import { DevSmsSender } from './dev-sms.sender';
import { createSmsSender } from './sms-sender.factory';
import { WingsSmsSender } from './wings-sms.sender';

function makeConfig(provider?: string): ConfigService {
  return {
    get: (key: string) => (key === 'SMS_PROVIDER' ? provider : undefined),
  } as unknown as ConfigService;
}

describe('createSmsSender', () => {
  it('returns WingsSmsSender for SMS_PROVIDER=wings', () => {
    expect(createSmsSender(makeConfig('wings'))).toBeInstanceOf(WingsSmsSender);
  });

  it('normalizes case and whitespace', () => {
    expect(createSmsSender(makeConfig(' Wings '))).toBeInstanceOf(
      WingsSmsSender,
    );
  });

  it('defaults to DevSmsSender when unset', () => {
    expect(createSmsSender(makeConfig(undefined))).toBeInstanceOf(DevSmsSender);
  });
});
