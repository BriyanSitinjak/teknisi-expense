import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { getIronSession, type SessionOptions } from "iron-session";
import type { UserRole } from "@/generated/prisma/client";

export type SessionData = {
  userId?: string;
  role?: UserRole;
  branchId?: string | null;
  name?: string;
  email?: string;
};

export type SessionUser = {
  id: string;
  role: UserRole;
  branchId: string | null;
  name: string;
  email: string;
};

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }

  return {
    cookieName: "ksa_session",
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

function cookieStore(c: Context) {
  return {
    get(name: string) {
      const value = getCookie(c, name);
      return value === undefined ? undefined : { name, value };
    },
    set(
      nameOrOptions: string | { name: string; value: string; [key: string]: unknown },
      value?: string,
      cookie?: Record<string, unknown>,
    ) {
      if (typeof nameOrOptions === "object") {
        const { name, value: cookieValue, ...options } = nameOrOptions;
        setCookie(c, name, cookieValue, options);
        return;
      }
      setCookie(c, nameOrOptions, value ?? "", cookie);
    },
  };
}

export async function getSession(c: Context) {
  const getSessionFromCookies = getIronSession as unknown as (
    cookies: ReturnType<typeof cookieStore>,
    options: SessionOptions,
  ) => Promise<import("iron-session").IronSession<SessionData>>;

  return getSessionFromCookies(cookieStore(c), sessionOptions());
}
