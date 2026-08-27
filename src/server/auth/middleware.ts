import type { MiddlewareHandler } from "hono";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, UnauthenticatedError } from "@/server/errors";
import { getSession, type SessionUser } from "@/server/auth/session";
import type { AppEnv } from "@/server/app-env";

export const attachSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await getSession(c);
  c.set("session", session);
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = c.get("session");
  if (!session.userId) {
    throw new UnauthenticatedError();
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: {
      id: true,
      role: true,
      branchId: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    session.destroy();
    throw new UnauthenticatedError();
  }

  const sessionUser: SessionUser = user;
  c.set("user", sessionUser);
  await session.save();
  await next();
};

export function requireRole(...roles: UserRole[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      throw new ForbiddenError();
    }
    await next();
  };
}

export function branchScope(user: SessionUser): { branchId?: string } {
  if (user.role === "branch_head") {
    return { branchId: user.branchId ?? undefined };
  }
  return {};
}
