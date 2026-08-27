import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { requireAuth, requireRole } from "@/server/auth/middleware";
import { ConflictError } from "@/server/errors";
import { errorResponses, jsonBody, jsonResponse, paginationQuery } from "@/server/openapi";

const citySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const listRoute = createRoute({
  method: "get",
  path: "/cities",
  tags: ["Cities"],
  middleware: [requireAuth],
  request: { query: paginationQuery.extend({ q: z.string().optional() }) },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(citySchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Daftar kota",
    ),
    ...errorResponses(401),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/cities",
  tags: ["Cities"],
  middleware: [requireAuth, requireRole("hr", "admin")],
  request: {
    body: jsonBody(z.object({ name: z.string().trim().min(1).max(100) })),
  },
  responses: {
    201: jsonResponse(citySchema, "Kota dibuat"),
    ...errorResponses(401, 403, 409, 422),
  },
});

export const cityRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const { page, limit, q } = c.req.valid("query");
    const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
    const [total, data] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true },
      }),
    ]);
    return c.json({ data, page, limit, total }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const { name } = c.req.valid("json");
    try {
      const city = await prisma.city.create({ data: { name }, select: { id: true, name: true } });
      return c.json(city, 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Nama kota sudah ada");
      }
      throw error;
    }
  });
