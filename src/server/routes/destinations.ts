import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { requireAuth, requireRole } from "@/server/auth/middleware";
import { NotFoundError } from "@/server/errors";
import { errorResponses, jsonBody, jsonResponse, paginationQuery } from "@/server/openapi";

const destinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultCityId: z.string().nullable(),
  defaultCity: z.object({ id: z.string(), name: z.string() }).nullable(),
});

const listRoute = createRoute({
  method: "get",
  path: "/destinations",
  tags: ["Destinations"],
  middleware: [requireAuth],
  request: { query: paginationQuery.extend({ q: z.string().optional() }) },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(destinationSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Daftar tujuan",
    ),
    ...errorResponses(401),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/destinations",
  tags: ["Destinations"],
  middleware: [requireAuth, requireRole("hr")],
  request: {
    body: jsonBody(
      z.object({
        name: z.string().trim().min(1).max(150),
        defaultCityId: z.uuid().nullable().optional(),
      }),
    ),
  },
  responses: {
    201: jsonResponse(destinationSchema, "Tujuan dibuat"),
    ...errorResponses(401, 403, 404, 422),
  },
});

export const destinationRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const { page, limit, q } = c.req.valid("query");
    const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
    const [total, data] = await Promise.all([
      prisma.destination.count({ where }),
      prisma.destination.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { defaultCity: { select: { id: true, name: true } } },
      }),
    ]);
    return c.json({ data, page, limit, total }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const { name, defaultCityId } = c.req.valid("json");
    if (defaultCityId) {
      const city = await prisma.city.findUnique({ where: { id: defaultCityId } });
      if (!city) throw new NotFoundError("Kota tidak ditemukan");
    }
    const destination = await prisma.destination.create({
      data: { name, defaultCityId: defaultCityId ?? null },
      include: { defaultCity: { select: { id: true, name: true } } },
    });
    return c.json(destination, 201);
  });
