import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { AppEnv } from "@/server/app-env";
import { requireAuth, requireRole } from "@/server/auth/middleware";
import { ConflictError } from "@/server/errors";
import { findEffectiveRate } from "@/server/services/rate";
import {
  errorResponses,
  formatIsoDate,
  isoDate,
  jsonBody,
  jsonResponse,
  parseIsoDate,
} from "@/server/openapi";

const rateSchema = z.object({
  id: z.string(),
  effectiveFrom: z.string(),
  pricePerLiter: z.number().int(),
  kmPerLiter: z.number(),
});

function serialize(rate: { id: string; effectiveFrom: Date; pricePerLiter: number; kmPerLiter: Prisma.Decimal | number }) {
  return {
    id: rate.id,
    effectiveFrom: formatIsoDate(rate.effectiveFrom),
    pricePerLiter: rate.pricePerLiter,
    kmPerLiter: Number(rate.kmPerLiter),
  };
}

const listRoute = createRoute({
  method: "get",
  path: "/fuel-rates",
  tags: ["Fuel rates"],
  middleware: [requireAuth],
  responses: {
    200: jsonResponse(z.array(rateSchema), "Riwayat tarif"),
    ...errorResponses(401),
  },
});

const effectiveRoute = createRoute({
  method: "get",
  path: "/fuel-rates/effective",
  tags: ["Fuel rates"],
  middleware: [requireAuth],
  request: { query: z.object({ date: isoDate }) },
  responses: {
    200: jsonResponse(rateSchema, "Tarif berlaku pada tanggal"),
    ...errorResponses(401, 422),
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/fuel-rates",
  tags: ["Fuel rates"],
  middleware: [requireAuth, requireRole("admin")],
  request: {
    body: jsonBody(
      z.object({
        effectiveFrom: isoDate,
        pricePerLiter: z.number().int().positive(),
        kmPerLiter: z.number().positive(),
      }),
    ),
  },
  responses: {
    201: jsonResponse(rateSchema, "Tarif ditambah"),
    ...errorResponses(401, 403, 409, 422),
  },
});

export const fuelRateRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const rates = await prisma.fuelRate.findMany({ orderBy: { effectiveFrom: "desc" } });
    return c.json(rates.map(serialize), 200);
  })
  .openapi(effectiveRoute, async (c) => {
    const { date } = c.req.valid("query");
    const rate = await findEffectiveRate(prisma, parseIsoDate(date));
    return c.json(serialize(rate), 200);
  })
  .openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    try {
      const rate = await prisma.fuelRate.create({
        data: {
          effectiveFrom: parseIsoDate(body.effectiveFrom),
          pricePerLiter: body.pricePerLiter,
          kmPerLiter: body.kmPerLiter,
        },
      });
      return c.json(serialize(rate), 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Tarif untuk tanggal itu sudah ada");
      }
      throw error;
    }
  });
