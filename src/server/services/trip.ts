import { InvalidOdometerError } from "@/server/services/fuel";
import { calculateTripFuel } from "@/server/services/fuel";
import { findEffectiveRate } from "@/server/services/rate";
import { assertPeriodWritable } from "@/server/services/period";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/errors";
import { formatIsoDate, parseIsoDate } from "@/server/openapi";
import { Prisma } from "@/generated/prisma/client";

export type TripInput = {
  technicianId: string;
  tripDate: string;
  cityId: string;
  destinationId: string;
  odoStart: number;
  odoEnd: number;
  tollAmount: number;
  parkingAmount: number;
  mealAmount: number;
  notes?: string | null;
  extraTitle?: string | null;
  extraValue?: string | null;
};

function yearMonth(date: Date) {
  return { periodYear: date.getUTCFullYear(), periodMonth: date.getUTCMonth() + 1 };
}

async function assertMasters(tx: Prisma.TransactionClient, input: TripInput) {
  const [technician, city, destination] = await Promise.all([
    tx.technician.findUnique({ where: { id: input.technicianId } }),
    tx.city.findUnique({ where: { id: input.cityId } }),
    tx.destination.findUnique({ where: { id: input.destinationId } }),
  ]);

  if (!technician) throw new NotFoundError("Teknisi tidak ditemukan");
  if (!technician.isActive) {
    throw new ValidationError("Teknisi tidak aktif", { technicianId: "Teknisi tidak aktif" });
  }
  if (!city) throw new NotFoundError("Kota tidak ditemukan");
  if (!destination) throw new NotFoundError("Tujuan tidak ditemukan");

  return technician;
}

async function snapshotFuel(tx: Prisma.TransactionClient, odoStart: number, odoEnd: number, tripDate: Date) {
  const rate = await findEffectiveRate(tx, tripDate);
  try {
    const fuel = calculateTripFuel(odoStart, odoEnd, {
      pricePerLiter: rate.pricePerLiter,
      kmPerLiter: rate.kmPerLiter,
    });
    return fuel;
  } catch (error) {
    if (error instanceof InvalidOdometerError) {
      throw new ValidationError(error.message, { odoEnd: error.message });
    }
    throw error;
  }
}

async function isOdoGapped(
  tx: Prisma.TransactionClient,
  technicianId: string,
  odoStart: number,
  excludeTripId?: string,
) {
  const last = await tx.trip.findFirst({
    where: {
      period: { technicianId },
      ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
    },
    orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
    select: { odoEnd: true },
  });

  return last != null && last.odoEnd !== odoStart;
}

export async function createTrip(input: TripInput) {
  const tripDate = parseIsoDate(input.tripDate);
  const { periodYear, periodMonth } = yearMonth(tripDate);

  try {
    return await prisma.$transaction(async (tx) => {
      const technician = await assertMasters(tx, input);
      const fuel = await snapshotFuel(tx, input.odoStart, input.odoEnd, tripDate);

      let period = await tx.expensePeriod.findUnique({
        where: {
          technicianId_periodYear_periodMonth: {
            technicianId: technician.id,
            periodYear,
            periodMonth,
          },
        },
      });

      if (!period) {
        try {
          period = await tx.expensePeriod.create({
            data: {
              technicianId: technician.id,
              branchId: technician.branchId,
              periodYear,
              periodMonth,
              status: "draft",
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            period = await tx.expensePeriod.findUniqueOrThrow({
              where: {
                technicianId_periodYear_periodMonth: {
                  technicianId: technician.id,
                  periodYear,
                  periodMonth,
                },
              },
            });
          } else {
            throw error;
          }
        }
      }

      assertPeriodWritable(period.status);

      const odoGapFlagged = await isOdoGapped(tx, technician.id, input.odoStart);

      return tx.trip.create({
        data: {
          periodId: period.id,
          tripDate,
          cityId: input.cityId,
          destinationId: input.destinationId,
          odoStart: input.odoStart,
          odoEnd: input.odoEnd,
          fuelPricePerLiter: fuel.fuelPricePerLiter,
          fuelKmPerLiter: fuel.fuelKmPerLiter,
          fuelCost: fuel.fuelCost,
          tollAmount: input.tollAmount,
          parkingAmount: input.parkingAmount,
          mealAmount: input.mealAmount,
          notes: input.notes?.trim() || null,
          extraTitle: input.extraTitle?.trim() || null,
          extraValue: input.extraValue?.trim() || null,
          odoGapFlagged,
        },
        include: tripInclude,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw error;
    }
    throw error;
  }
}

export async function updateTrip(id: string, input: TripInput) {
  const tripDate = parseIsoDate(input.tripDate);
  const { periodYear, periodMonth } = yearMonth(tripDate);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.trip.findUnique({
      where: { id },
      include: { period: true },
    });

    if (!existing) {
      throw new NotFoundError();
    }

    assertPeriodWritable(existing.period.status);

    if (existing.period.technicianId !== input.technicianId) {
      throw new ValidationError("Teknisi tidak boleh diubah", { technicianId: "Teknisi tidak boleh diubah" });
    }

    if (existing.period.periodYear !== periodYear || existing.period.periodMonth !== periodMonth) {
      throw new ValidationError("Tanggal harus tetap di bulan periode yang sama", {
        tripDate: "Tanggal harus tetap di bulan periode yang sama",
      });
    }

    await assertMasters(tx, input);
    const fuel = await snapshotFuel(tx, input.odoStart, input.odoEnd, tripDate);
    const odoGapFlagged = await isOdoGapped(tx, input.technicianId, input.odoStart, id);

    return tx.trip.update({
      where: { id },
      data: {
        tripDate,
        cityId: input.cityId,
        destinationId: input.destinationId,
        odoStart: input.odoStart,
        odoEnd: input.odoEnd,
        fuelPricePerLiter: fuel.fuelPricePerLiter,
        fuelKmPerLiter: fuel.fuelKmPerLiter,
        fuelCost: fuel.fuelCost,
        tollAmount: input.tollAmount,
        parkingAmount: input.parkingAmount,
        mealAmount: input.mealAmount,
        notes: input.notes?.trim() || null,
        extraTitle: input.extraTitle?.trim() || null,
        extraValue: input.extraValue?.trim() || null,
        odoGapFlagged,
      },
      include: tripInclude,
    });
  });
}

export async function deleteTrip(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.trip.findUnique({
      where: { id },
      include: { period: true },
    });

    if (!existing) {
      throw new NotFoundError();
    }

    assertPeriodWritable(existing.period.status);
    await tx.trip.delete({ where: { id } });
  });
}

export async function odometerHint(technicianId: string, date: string) {
  const tripDate = parseIsoDate(date);
  const last = await prisma.trip.findFirst({
    where: {
      period: { technicianId },
      tripDate: { lte: tripDate },
    },
    orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
    select: { odoEnd: true, tripDate: true },
  });

  return {
    odoStart: last?.odoEnd ?? null,
    fromDate: last ? formatIsoDate(last.tripDate) : null,
  };
}

export const tripInclude = {
  city: { select: { id: true, name: true } },
  destination: { select: { id: true, name: true } },
  period: {
    select: {
      id: true,
      technicianId: true,
      branchId: true,
      periodYear: true,
      periodMonth: true,
      status: true,
      technician: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export function serializeTrip(trip: {
  id: string;
  periodId: string;
  tripDate: Date;
  cityId: string;
  destinationId: string;
  odoStart: number;
  odoEnd: number;
  distanceKm: number;
  fuelPricePerLiter: number;
  fuelKmPerLiter: Prisma.Decimal | number;
  fuelCost: number;
  tollAmount: number;
  parkingAmount: number;
  mealAmount: number;
  totalAmount: number;
  notes: string | null;
  extraTitle: string | null;
  extraValue: string | null;
  odoGapFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
  city?: { id: string; name: string };
  destination?: { id: string; name: string };
  period?: {
    id: string;
    technicianId: string;
    branchId: string;
    periodYear: number;
    periodMonth: number;
    status: string;
    technician?: { id: string; code: string; name: string };
  };
}) {
  return {
    id: trip.id,
    periodId: trip.periodId,
    tripDate: formatIsoDate(trip.tripDate),
    cityId: trip.cityId,
    destinationId: trip.destinationId,
    odoStart: trip.odoStart,
    odoEnd: trip.odoEnd,
    distanceKm: trip.distanceKm,
    fuelPricePerLiter: trip.fuelPricePerLiter,
    fuelKmPerLiter: Number(trip.fuelKmPerLiter),
    fuelCost: trip.fuelCost,
    tollAmount: trip.tollAmount,
    parkingAmount: trip.parkingAmount,
    mealAmount: trip.mealAmount,
    totalAmount: trip.totalAmount,
    notes: trip.notes,
    extraTitle: trip.extraTitle,
    extraValue: trip.extraValue,
    odoGapFlagged: trip.odoGapFlagged,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    city: trip.city,
    destination: trip.destination,
    technicianId: trip.period?.technicianId,
    technician: trip.period?.technician,
    periodStatus: trip.period?.status,
  };
}
