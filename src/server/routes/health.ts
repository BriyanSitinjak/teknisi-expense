import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { jsonResponse } from "@/server/openapi";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  responses: {
    200: jsonResponse(
      z.object({
        ok: z.boolean(),
        db: z.literal("ok"),
        pooled: z.boolean(),
      }),
      "Pooled connection proven",
    ),
  },
});

export const healthRoutes = new OpenAPIHono<AppEnv>().openapi(healthRoute, async (c) => {
  await prisma.$queryRaw`SELECT 1`;
  const pooled = (process.env.DATABASE_URL ?? "").includes("-pooler");
  return c.json({ ok: true, db: "ok" as const, pooled }, 200);
});
