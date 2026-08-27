import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { requireAuth, requireRole } from "@/server/auth/middleware";
import { ConflictError, NotFoundError } from "@/server/errors";
import { errorResponses, jsonBody, jsonResponse, paginationQuery, uuidParam } from "@/server/openapi";

const technicianSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  branchId: z.string(),
  isActive: z.boolean(),
  branch: z.object({ id: z.string(), code: z.string(), name: z.string() }),
});

const listRoute = createRoute({
  method: "get",
  path: "/technicians",
  tags: ["Technicians"],
  middleware: [requireAuth],
  request: {
    query: paginationQuery.extend({
      q: z.string().optional(),
      branchId: z.uuid().optional(),
      active: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(technicianSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Daftar teknisi",
    ),
    ...errorResponses(401),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/technicians",
  tags: ["Technicians"],
  middleware: [requireAuth, requireRole("hr", "admin")],
  request: {
    body: jsonBody(
      z.object({
        code: z.string().trim().min(1).max(30),
        name: z.string().trim().min(1).max(100),
        branchId: z.uuid(),
      }),
    ),
  },
  responses: {
    201: jsonResponse(technicianSchema, "Teknisi dibuat"),
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

const patchRoute = createRoute({
  method: "patch",
  path: "/technicians/{id}",
  tags: ["Technicians"],
  middleware: [requireAuth, requireRole("hr", "admin")],
  request: {
    params: uuidParam,
    body: jsonBody(
      z.object({
        code: z.string().trim().min(1).max(30).optional(),
        name: z.string().trim().min(1).max(100).optional(),
        branchId: z.uuid().optional(),
        isActive: z.boolean().optional(),
      }),
    ),
  },
  responses: {
    200: jsonResponse(technicianSchema, "Teknisi diubah"),
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

const include = { branch: { select: { id: true, code: true, name: true } } } as const;

export const technicianRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const { page, limit, q, branchId, active } = c.req.valid("query");
    const user = c.get("user");
    const where = {
      ...(user.role === "branch_head" ? { branchId: user.branchId ?? undefined } : {}),
      ...(branchId ? { branchId } : {}),
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      prisma.technician.count({ where }),
      prisma.technician.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
    ]);
    return c.json({ data, page, limit, total }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) throw new NotFoundError("Cabang tidak ditemukan");
    try {
      const technician = await prisma.technician.create({ data: body, include });
      return c.json(technician, 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Kode teknisi sudah digunakan");
      }
      throw error;
    }
  })
  .openapi(patchRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const existing = await prisma.technician.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
      if (!branch) throw new NotFoundError("Cabang tidak ditemukan");
    }
    try {
      const technician = await prisma.technician.update({ where: { id }, data: body, include });
      return c.json(technician, 200);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Kode teknisi sudah digunakan");
      }
      throw error;
    }
  });
