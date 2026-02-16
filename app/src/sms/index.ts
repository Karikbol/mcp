import { config } from "../config.js";
import type { SmsProvider } from "./types.js";
import { MockSmsProvider } from "./MockSmsProvider.js";
import { RealSmsProvider } from "./RealSmsProvider.js";

export type { SmsProvider } from "./types.js";

export function createSmsProvider(sendToAdmin: (message: string) => Promise<void>): SmsProvider {
  if (config.smsProvider === "real") {
    return new RealSmsProvider();
  }
  return new MockSmsProvider(sendToAdmin);
}
