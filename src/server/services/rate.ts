import type { PrismaClient } from "@/generated/prisma/client";
import { RateNotFoundError } from "@/server/errors";

type Db = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export async function findEffectiveRate(db: Db, tripDate: Date) {
  const rate = await db.fuelRate.findFirst({
    where: { effectiveFrom: { lte: tripDate } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!rate) {
    throw new RateNotFoundError();
  }

  return {
    id: rate.id,
    effectiveFrom: rate.effectiveFrom,
    pricePerLiter: rate.pricePerLiter,
    kmPerLiter: Number(rate.kmPerLiter),
  };
}
