/**
 * Fuel cost calculation.
 *
 * This is the only place in the system that turns odometer readings into money.
 * It is a pure function on purpose: no database, no HTTP, no Prisma. That makes it
 * the easiest thing in the project to test, and money is the thing most worth testing.
 *
 * See 03-data-model.md Part 1 for why the result is stored rather than derived.
 */

export type FuelRate = {
  /** Whole rupiah per litre, e.g. 10000 */
  pricePerLiter: number
  /** Kilometres per litre, up to 2 decimal places, e.g. 30 or 32.5 */
  kmPerLiter: number
}

export class InvalidOdometerError extends Error {}
export class InvalidRateError extends Error {}

/**
 * Distance travelled. Throws if the odometer did not advance, because that is
 * impossible data rather than merely suspicious data.
 *
 * A jumping odo_start (this trip starting higher than the last trip ended) is
 * suspicious, not impossible. That is handled elsewhere as a warning, not here.
 */
export function distanceKm(odoStart: number, odoEnd: number): number {
  if (!Number.isInteger(odoStart) || !Number.isInteger(odoEnd)) {
    throw new InvalidOdometerError('Odometer readings must be whole kilometres')
  }
  if (odoStart < 0) {
    throw new InvalidOdometerError('Km awal tidak boleh kurang dari 0')
  }
  if (odoEnd <= odoStart) {
    throw new InvalidOdometerError('Km akhir harus lebih besar dari km awal')
  }
  return odoEnd - odoStart
}

/**
 * Fuel cost in whole rupiah, rounded half up.
 *
 * Why the x100 scaling instead of the obvious `distance * price / kmPerLiter`:
 *
 * kmPerLiter carries 2 decimal places. Dividing by a fractional double lets binary
 * floating point drift, and the case that matters is an exact half. If the true
 * answer is 312.5 and the float lands on 312.49999999999994, Math.round gives 312
 * instead of 313, and one rupiah goes missing on a signed report.
 *
 * Scaling both sides to integers first means the division is integer over integer.
 * Any exact-half result is then a true half-integer, which doubles represent exactly,
 * so Math.round is reliable. Math.round rounds half away from zero, and every value
 * here is positive, so that is half up.
 *
 * Headroom check: distance 2.000 km at Rp 20.000/l gives a numerator of 4e9, well
 * inside Number.MAX_SAFE_INTEGER (about 9e15).
 */
export function fuelCost(distance: number, rate: FuelRate): number {
  if (!Number.isInteger(distance) || distance < 0) {
    throw new InvalidOdometerError('Distance must be a non-negative whole number')
  }
  if (!Number.isInteger(rate.pricePerLiter) || rate.pricePerLiter <= 0) {
    throw new InvalidRateError('pricePerLiter must be a positive whole rupiah amount')
  }
  if (!(rate.kmPerLiter > 0)) {
    throw new InvalidRateError('kmPerLiter must be greater than 0')
  }

  const kmPerLiterScaled = Math.round(rate.kmPerLiter * 100)
  const numerator = distance * rate.pricePerLiter * 100

  return Math.round(numerator / kmPerLiterScaled)
}

/** Convenience: cost per kilometre, for display only. Never stored. */
export function costPerKm(rate: FuelRate): number {
  return rate.pricePerLiter / rate.kmPerLiter
}

/**
 * Everything a trip needs to snapshot at write time.
 *
 * The caller passes the rate row that was effective on the trip's own date. It must
 * never pass "the current rate" or a constant. If no rate is effective on that date,
 * the caller returns RATE_NOT_FOUND and does not reach this function.
 *
 * Note on Prisma: kmPerLiter comes back as a Decimal. Convert with Number(...) at
 * the call site, not in here, so this file stays free of ORM types.
 */
export function calculateTripFuel(
  odoStart: number,
  odoEnd: number,
  rate: FuelRate,
): {
  distanceKm: number
  fuelCost: number
  fuelPricePerLiter: number
  fuelKmPerLiter: number
} {
  const distance = distanceKm(odoStart, odoEnd)
  return {
    distanceKm: distance,
    fuelCost: fuelCost(distance, rate),
    fuelPricePerLiter: rate.pricePerLiter,
    fuelKmPerLiter: rate.kmPerLiter,
  }
}
