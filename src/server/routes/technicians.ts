import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { branchScope, requireAuth, requireRole } from "@/server/auth/middleware";
import { ConflictError, NotFoundError } from "@/server/errors";
import { errorResponses, formatIsoDate, jsonBody, jsonResponse, paginationQuery, uuidParam } from "@/server/openapi";

const technicianSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  branchId: z.string(),
  isActive: z.boolean(),
  branch: z.object({ id: z.string(), code: z.string(), name: z.string() }),
});

const lastTripSchema = z
  .object({
    tripDate: z.string(),
    odoEnd: z.number().int(),
    destinationName: z.string(),
  })
  .nullable();

const technicianListSchema = technicianSchema.extend({
  lastTrip: lastTripSchema,
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
        data: z.array(technicianListSchema),
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
  middleware: [requireAuth, requireRole("hr")],
  request: {
    body: jsonBody(
      z.object({
        code: z.string().trim().min(1).max(30),
        name: z.string().trim().min(1).max(100),
        branchId: z.uuid().optional(),
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
  middleware: [requireAuth, requireRole("hr")],
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

const tripHistorySchema = z.object({
  id: z.string(),
  tripDate: z.string(),
  destinationName: z.string(),
  cityName: z.string(),
  odoStart: z.number().int(),
  odoEnd: z.number().int(),
  distanceKm: z.number().int(),
  fuelCost: z.number().int(),
  tollAmount: z.number().int(),
  parkingAmount: z.number().int(),
  mealAmount: z.number().int(),
  totalAmount: z.number().int(),
  notes: z.string().nullable(),
  extraTitle: z.string().nullable(),
  extraValue: z.string().nullable(),
  periodStatus: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
});

const historyRoute = createRoute({
  method: "get",
  path: "/technicians/{id}/trips",
  tags: ["Technicians"],
  middleware: [requireAuth],
  request: {
    params: uuidParam,
    query: paginationQuery,
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(tripHistorySchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Riwayat perjalanan teknisi",
    ),
    ...errorResponses(401, 404),
  },
});

const include = { branch: { select: { id: true, code: true, name: true } } } as const;

async function lastTripsFor(technicianIds: string[]) {
  const latest = new Map<string, { tripDate: string; odoEnd: number; destinationName: string }>();
  if (technicianIds.length === 0) return latest;

  const trips = await prisma.trip.findMany({
    where: { period: { technicianId: { in: technicianIds } } },
    orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
    select: {
      odoEnd: true,
      tripDate: true,
      destination: { select: { name: true } },
      period: { select: { technicianId: true } },
    },
  });

  for (const trip of trips) {
    const technicianId = trip.period.technicianId;
    if (latest.has(technicianId)) continue;
    latest.set(technicianId, {
      tripDate: formatIsoDate(trip.tripDate),
      odoEnd: trip.odoEnd,
      destinationName: trip.destination.name,
    });
  }

  return latest;
}

async function resolveBranchId(branchId?: string) {
  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId } })
    : ((await prisma.branch.findUnique({ where: { code: "JKT" } })) ??
      (await prisma.branch.findFirst({ orderBy: { code: "asc" } })));
  if (!branch) throw new NotFoundError("Cabang tidak ditemukan");
  return branch.id;
}

function throwTechnicianCodeConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictError("Kode teknisi sudah digunakan");
  }
  throw error;
}

export const technicianRoutes = new OpenAPIHono<AppEnv>()
  .openapi(historyRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { page, limit } = c.req.valid("query");
    const technician = await prisma.technician.findFirst({
      where: { id, ...branchScope(c.get("user")) },
      select: { id: true },
    });
    if (!technician) throw new NotFoundError();

    const where = { period: { technicianId: id } };
    const [total, rows] = await Promise.all([
      prisma.trip.count({ where }),
      prisma.trip.findMany({
        where,
        orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          tripDate: true,
          odoStart: true,
          odoEnd: true,
          distanceKm: true,
          fuelCost: true,
          tollAmount: true,
          parkingAmount: true,
          mealAmount: true,
          totalAmount: true,
          notes: true,
          extraTitle: true,
          extraValue: true,
          destination: { select: { name: true } },
          city: { select: { name: true } },
          period: { select: { status: true, periodYear: true, periodMonth: true } },
        },
      }),
    ]);

    return c.json(
      {
        data: rows.map((trip) => ({
          id: trip.id,
          tripDate: formatIsoDate(trip.tripDate),
          destinationName: trip.destination.name,
          cityName: trip.city.name,
          odoStart: trip.odoStart,
          odoEnd: trip.odoEnd,
          distanceKm: trip.distanceKm,
          fuelCost: trip.fuelCost,
          tollAmount: trip.tollAmount,
          parkingAmount: trip.parkingAmount,
          mealAmount: trip.mealAmount,
          totalAmount: trip.totalAmount,
          notes: trip.notes,
          extraTitle: trip.extraTitle,
          extraValue: trip.extraValue,
          periodStatus: trip.period.status,
          periodYear: trip.period.periodYear,
          periodMonth: trip.period.periodMonth,
        })),
        page,
        limit,
        total,
      },
      200,
    );
  })
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
    const lastTrips = await lastTripsFor(data.map((row) => row.id));
    return c.json(
      {
        data: data.map((row) => ({ ...row, lastTrip: lastTrips.get(row.id) ?? null })),
        page,
        limit,
        total,
      },
      200,
    );
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const branchId = await resolveBranchId(body.branchId);
    try {
      const technician = await prisma.technician.create({
        data: { code: body.code, name: body.name, branchId },
        include,
      });
      return c.json(technician, 201);
    } catch (error) {
      throwTechnicianCodeConflict(error);
    }
  })
  .openapi(patchRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const existing = await prisma.technician.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (body.branchId) await resolveBranchId(body.branchId);
    try {
      const technician = await prisma.technician.update({ where: { id }, data: body, include });
      return c.json(technician, 200);
    } catch (error) {
      throwTechnicianCodeConflict(error);
    }
  });
