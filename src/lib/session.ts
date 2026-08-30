import "server-only";
import { cookies } from "next/headers";

const SESSION_COOKIE = "tf_session";

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}