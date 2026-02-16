import { getSession } from "../db/authSessions.js";
import { findByTgId } from "../db/users.js";

export async function getLoginUser(sessionId: string): Promise<
  | { ok: true; user: { first_name: string; last_name: string; phone_masked: string; recovered_flag: boolean } }
  | { ok: false; error: "session_invalid" }
> {
  const session = await getSession(sessionId);
  if (!session || session.purpose !== "login") {
    return { ok: false, error: "session_invalid" };
  }
  const tgId = session.tg_id;
  if (tgId == null) {
    return { ok: false, error: "session_invalid" };
  }
  const user = await findByTgId(tgId);
  if (!user) {
    return { ok: false, error: "session_invalid" };
  }
  const phoneMasked = "****" + user.phone_e164.slice(-4);
  return {
    ok: true,
    user: {
      first_name: user.first_name,
      last_name: user.last_name,
      phone_masked: phoneMasked,
      recovered_flag: user.recovered_flag,
    },
  };
}
