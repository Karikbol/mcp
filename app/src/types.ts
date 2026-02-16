import type { Context } from "telegraf";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export type TelegrafContext = Context & {
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
};
