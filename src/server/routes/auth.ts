import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { requireAuth } from "@/server/auth/middleware";
import { errorResponses, jsonBody, jsonResponse } from "@/server/openapi";
import { UnauthenticatedError } from "@/server/errors";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["hr", "branch_head"]),
  branchId: z.string().nullable(),
  branch: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
    .nullable(),
});

const loginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  request: {
    body: jsonBody(
      z.object({
        email: z.email(),
        password: z.string().min(1),
      }),
    ),
  },
  responses: {
    200: jsonResponse(userSchema, "Masuk berhasil"),
    ...errorResponses(401, 422),
  },
});

const logoutRoute = createRoute({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  responses: {
    200: jsonResponse(z.object({ ok: z.boolean() }), "Keluar"),
  },
});

const meRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  middleware: [requireAuth],
  responses: {
    200: jsonResponse(userSchema, "Pengguna saat ini"),
    ...errorResponses(401),
  },
});

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: "hr" | "branch_head";
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    branch: user.branch,
  };
}

export const authRoutes = new OpenAPIHono<AppEnv>()
  .openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });

    const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const matches = await verifyPassword(password, hash);
    const ok = Boolean(user && user.isActive && matches);

    if (!ok) {
      throw new UnauthenticatedError("Email atau kata sandi salah");
    }

    const session = c.get("session");
    session.userId = user!.id;
    session.role = user!.role;
    session.branchId = user!.branchId;
    session.name = user!.name;
    session.email = user!.email;
    await session.save();

    return c.json(publicUser(user!), 200);
  })
  .openapi(logoutRoute, async (c) => {
    const session = c.get("session");
    session.destroy();
    return c.json({ ok: true }, 200);
  })
  .openapi(meRoute, async (c) => {
    const current = c.get("user");
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: current.id },
      include: { branch: { select: { id: true, code: true, name: true } } },
    });
    return c.json(publicUser(user), 200);
  });
