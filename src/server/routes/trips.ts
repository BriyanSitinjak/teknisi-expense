import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { branchScope, requireAuth, requireRole } from "@/server/auth/middleware";
import { NotFoundError } from "@/server/errors";
import { createTrip, deleteTrip, odometerHint, serializeTrip, tripInclude, updateTrip } from "@/server/services/trip";
import {
  errorResponses,
  isoDate,
  jsonBody,
  jsonResponse,
  paginationQuery,
  uuidParam,
} from "@/server/openapi";

const tripSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  tripDate: z.string(),
  cityId: z.string(),
  destinationId: z.string(),
  odoStart: z.number(),
  odoEnd: z.number(),
  distanceKm: z.number(),
  fuelPricePerLiter: z.number(),
  fuelKmPerLiter: z.number(),
  fuelCost: z.number(),
  tollAmount: z.number(),
  parkingAmount: z.number(),
  mealAmount: z.number(),
  totalAmount: z.number(),
  notes: z.string().nullable(),
  extraTitle: z.string().nullable(),
  extraValue: z.string().nullable(),
  odoGapFlagged: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  city: z.object({ id: z.string(), name: z.string() }).optional(),
  destination: z.object({ id: z.string(), name: z.string() }).optional(),
  technicianId: z.string().optional(),
  technician: z.object({ id: z.string(), code: z.string(), name: z.string() }).optional(),
  periodStatus: z.string().optional(),
});

const tripBody = z.object({
  technicianId: z.uuid(),
  tripDate: isoDate,
  cityId: z.uuid(),
  destinationId: z.uuid(),
  odoStart: z.number().int().nonnegative(),
  odoEnd: z.number().int().positive(),
  tollAmount: z.number().int().nonnegative().default(0),
  parkingAmount: z.number().int().nonnegative().default(0),
  mealAmount: z.number().int().nonnegative().default(0),
  notes: z.string().max(500).nullable().optional(),
  extraTitle: z.string().trim().max(100).nullable().optional(),
  extraValue: z
    .string()
    .trim()
    .regex(/^\d+$/, "Nilai harus berupa angka")
    .max(12)
    .nullable()
    .optional(),
});

const listRoute = createRoute({
  method: "get",
  path: "/trips",
  tags: ["Trips"],
  middleware: [requireAuth],
  request: {
    query: paginationQuery.extend({
      periodId: z.uuid(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(tripSchema),
        page: z.number(),
        limit: z.number(),
        total: z.number(),
      }),
      "Daftar perjalanan",
    ),
    ...errorResponses(401, 404),
  },
});

const hintRoute = createRoute({
  method: "get",
  path: "/trips/odometer-hint",
  tags: ["Trips"],
  middleware: [requireAuth, requireRole("hr")],
  request: {
    query: z.object({
      technicianId: z.uuid(),
      date: isoDate,
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        odoStart: z.number().nullable(),
        fromDate: z.string().nullable(),
      }),
      "Km awal dari trip terakhir",
    ),
    ...errorResponses(401, 403, 422),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/trips",
  tags: ["Trips"],
  middleware: [requireAuth, requireRole("hr")],
  request: { body: jsonBody(tripBody) },
  responses: {
    201: jsonResponse(tripSchema, "Perjalanan tersimpan"),
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

const patchRoute = createRoute({
  method: "patch",
  path: "/trips/{id}",
  tags: ["Trips"],
  middleware: [requireAuth, requireRole("hr")],
  request: {
    params: uuidParam,
    body: jsonBody(tripBody.partial().extend({ technicianId: z.uuid().optional(), tripDate: isoDate.optional() })),
  },
  responses: {
    200: jsonResponse(tripSchema, "Perjalanan diubah"),
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/trips/{id}",
  tags: ["Trips"],
  middleware: [requireAuth, requireRole("hr")],
  request: { params: uuidParam },
  responses: {
    200: jsonResponse(z.object({ ok: z.boolean() }), "Perjalanan dihapus"),
    ...errorResponses(401, 403, 404, 409),
  },
});

export const tripRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const user = c.get("user");
    const { page, limit, periodId } = c.req.valid("query");
    const period = await prisma.expensePeriod.findFirst({
      where: { id: periodId, ...branchScope(user) },
    });
    if (!period) throw new NotFoundError();
    const [total, rows] = await Promise.all([
      prisma.trip.count({ where: { periodId } }),
      prisma.trip.findMany({
        where: { periodId },
        orderBy: [{ tripDate: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: tripInclude,
      }),
    ]);
    return c.json({ data: rows.map(serializeTrip), page, limit, total }, 200);
  })
  .openapi(hintRoute, async (c) => {
    const { technicianId, date } = c.req.valid("query");
    return c.json(await odometerHint(technicianId, date), 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const trip = await createTrip({
      ...body,
      tollAmount: body.tollAmount ?? 0,
      parkingAmount: body.parkingAmount ?? 0,
      mealAmount: body.mealAmount ?? 0,
    });
    return c.json(serializeTrip(trip), 201);
  })
  .openapi(patchRoute, async (c) => {
    const { id } = c.req.valid("param");
    const existing = await prisma.trip.findFirst({
      where: { id },
      include: { period: true },
    });
    if (!existing) throw new NotFoundError();
    const body = c.req.valid("json");
    const trip = await updateTrip(id, {
      technicianId: body.technicianId ?? existing.period.technicianId,
      tripDate: body.tripDate ?? existing.tripDate.toISOString().slice(0, 10),
      cityId: body.cityId ?? existing.cityId,
      destinationId: body.destinationId ?? existing.destinationId,
      odoStart: body.odoStart ?? existing.odoStart,
      odoEnd: body.odoEnd ?? existing.odoEnd,
      tollAmount: body.tollAmount ?? existing.tollAmount,
      parkingAmount: body.parkingAmount ?? existing.parkingAmount,
      mealAmount: body.mealAmount ?? existing.mealAmount,
      notes: body.notes === undefined ? existing.notes : body.notes,
      extraTitle: body.extraTitle === undefined ? existing.extraTitle : body.extraTitle,
      extraValue: body.extraValue === undefined ? existing.extraValue : body.extraValue,
    });
    return c.json(serializeTrip(trip), 200);
  })
  .openapi(deleteRoute, async (c) => {
    await deleteTrip(c.req.valid("param").id);
    return c.json({ ok: true }, 200);
  });
