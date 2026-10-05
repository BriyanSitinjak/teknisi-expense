import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { branchScope, requireAuth, requireRole } from "@/server/auth/middleware";
import { getPeriodForUser, serializePeriod, transitionPeriod } from "@/server/services/period";
import { errorResponses, jsonBody, jsonResponse, paginationQuery, uuidParam } from "@/server/openapi";

const periodSchema = z.object({
  id: z.string(),
  technicianId: z.string(),
  branchId: z.string(),
  year: z.number(),
  month: z.number(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  technician: z.object({ id: z.string(), code: z.string(), name: z.string() }).optional(),
  branch: z.object({ id: z.string(), code: z.string(), name: z.string() }).optional(),
  tripCount: z.number(),
  totalAmount: z.number(),
});

const listRoute = createRoute({
  method: "get",
  path: "/periods",
  tags: ["Periods"],
  middleware: [requireAuth],
  request: {
    query: paginationQuery.extend({
      year: z.coerce.number().int().optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      branchId: z.uuid().optional(),
      technicianId: z.uuid().optional(),
      status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(periodSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Daftar periode",
    ),
    ...errorResponses(401),
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/periods/{id}",
  tags: ["Periods"],
  middleware: [requireAuth],
  request: { params: uuidParam },
  responses: {
    200: jsonResponse(periodSchema, "Detail periode"),
    ...errorResponses(401, 404),
  },
});

function actionRoute(action: "submit" | "approve" | "reject" | "reopen", roles: Array<"hr" | "branch_head">) {
  return createRoute({
    method: "post",
    path: `/periods/{id}/${action}`,
    tags: ["Periods"],
    middleware: [requireAuth, requireRole(...roles)],
    request: {
      params: uuidParam,
      body: jsonBody(z.object({ reason: z.string().optional() }).optional()),
    },
    responses: {
      200: jsonResponse(periodSchema, `Periode ${action}`),
      ...errorResponses(401, 403, 404, 409, 422),
    },
  });
}

const submitRoute = actionRoute("submit", ["hr"]);
const approveRoute = actionRoute("approve", ["branch_head", "hr"]);
const rejectRoute = actionRoute("reject", ["branch_head", "hr"]);
const reopenRoute = actionRoute("reopen", ["branch_head", "hr"]);

async function totalsFor(periodId: string) {
  const agg = await prisma.trip.aggregate({
    where: { periodId },
    _count: true,
    _sum: { totalAmount: true },
  });
  return { tripCount: agg._count, totalAmount: agg._sum.totalAmount ?? 0 };
}

export const periodRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const user = c.get("user");
    const { page, limit, year, month, branchId, technicianId, status } = c.req.valid("query");
    const where = {
      ...branchScope(user),
      ...(year ? { periodYear: year } : {}),
      ...(month ? { periodMonth: month } : {}),
      ...(branchId && user.role !== "branch_head" ? { branchId } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(status ? { status } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.expensePeriod.count({ where }),
      prisma.expensePeriod.findMany({
        where,
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          technician: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          _count: { select: { trips: true } },
          trips: { select: { totalAmount: true } },
        },
      }),
    ]);
    const data = rows.map((row) =>
      serializePeriod(row, {
        tripCount: row._count.trips,
        totalAmount: row.trips.reduce((sum, trip) => sum + trip.totalAmount, 0),
      }),
    );
    return c.json({ data, page, limit, total }, 200);
  })
  .openapi(getRoute, async (c) => {
    const period = await getPeriodForUser(c.req.valid("param").id, c.get("user"));
    return c.json(serializePeriod(period, await totalsFor(period.id)), 200);
  })
  .openapi(submitRoute, async (c) => {
    const period = await transitionPeriod(c.req.valid("param").id, "submit", c.get("user"), c.req.valid("json")?.reason);
    return c.json(serializePeriod(period, await totalsFor(period.id)), 200);
  })
  .openapi(approveRoute, async (c) => {
    const period = await transitionPeriod(c.req.valid("param").id, "approve", c.get("user"), c.req.valid("json")?.reason);
    return c.json(serializePeriod(period, await totalsFor(period.id)), 200);
  })
  .openapi(rejectRoute, async (c) => {
    const period = await transitionPeriod(c.req.valid("param").id, "reject", c.get("user"), c.req.valid("json")?.reason);
    return c.json(serializePeriod(period, await totalsFor(period.id)), 200);
  })
  .openapi(reopenRoute, async (c) => {
    const period = await transitionPeriod(c.req.valid("param").id, "reopen", c.get("user"), c.req.valid("json")?.reason);
    return c.json(serializePeriod(period, await totalsFor(period.id)), 200);
  });
