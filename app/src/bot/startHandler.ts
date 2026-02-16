import type { TelegrafContext } from "../types.js";
import { config } from "../config.js";
import { findByTgId, updateLastSeen } from "../db/users.js";
import { createSession } from "../db/authSessions.js";
import { logger } from "../logger.js";

const WEBAPP_BASE = config.webappBaseUrl;

export async function handleStart(ctx: TelegrafContext): Promise<void> {
  const tgId = ctx.from?.id;
  if (!tgId) return;

  try {
    await ctx.deleteMessage().catch(() => {});
  } catch {
    // ignore
  }

  const user = await findByTgId(tgId);
  if (user) {
    updateLastSeen(tgId).catch(() => {});
  }

  const isNew = !user;
  let registerSessionId: string | undefined;
  let loginSessionId: string | undefined;

  if (isNew) {
    registerSessionId = await createSession(tgId, "register");
  } else {
    loginSessionId = await createSession(tgId, "login");
  }

  const welcomeText =
    "Добро пожаловать.\n\n" +
    (isNew
      ? "Нажмите кнопку ниже, чтобы зарегистрироваться."
      : "Вы уже зарегистрированы. Нажмите кнопку ниже для входа.") +
    "\n\nТелефон используется только для восстановления доступа.";

  const registerUrl = registerSessionId
    ? `${WEBAPP_BASE}/webapp/register?session=${registerSessionId}`
    : null;
  const loginUrl = loginSessionId
    ? `${WEBAPP_BASE}/webapp/login?session=${loginSessionId}`
    : null;

  const buttons: { text: string; web_app: { url: string } }[] = [];
  if (registerUrl) buttons.push({ text: "📝 Регистрация", web_app: { url: registerUrl } });
  if (loginUrl) buttons.push({ text: "🔐 Войти", web_app: { url: loginUrl } });

  if (buttons.length === 0) {
    logger.warn({ tgId }, "No session created for /start");
    await ctx.reply(welcomeText);
    return;
  }

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [buttons],
    },
  });
}
