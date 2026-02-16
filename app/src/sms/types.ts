export interface SmsProvider {
  /** Send OTP to phone. Returns true if sent (or mocked). */
  sendOtp(phoneE164: string, code: string): Promise<boolean>;
}
