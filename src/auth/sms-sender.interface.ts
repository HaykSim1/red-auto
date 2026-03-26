export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}
