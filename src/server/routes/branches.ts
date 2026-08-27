import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { requireAuth } from "@/server/auth/middleware";
import { errorResponses, jsonResponse } from "@/server/openapi";

const branchSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

const listRoute = createRoute({
  method: "get",
  path: "/branches",
  tags: ["Branches"],
  middleware: [requireAuth],
  responses: {
    200: jsonResponse(z.array(branchSchema), "Daftar cabang"),
    ...errorResponses(401),
  },
});

export const branchRoutes = new OpenAPIHono<AppEnv>().openapi(listRoute, async (c) => {
  const user = c.get("user");
  const branches = await prisma.branch.findMany({
    where: user.role === "branch_head" ? { id: user.branchId ?? undefined } : undefined,
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return c.json(branches, 200);
});
