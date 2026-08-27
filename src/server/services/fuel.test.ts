import { describe, it, expect } from 'vitest'
import {
  distanceKm,
  fuelCost,
  calculateTripFuel,
  InvalidOdometerError,
  InvalidRateError,
} from './fuel'

/**
 * Vitest refresher, five lines, because it has been a while:
 *
 *   describe('group', () => { ... })     groups related tests
 *   it('does a thing', () => { ... })    one test. `test` is an alias.
 *   expect(actual).toBe(expected)        strict equality, for primitives
 *   expect(actual).toEqual(expected)     deep equality, for objects and arrays
 *   expect(() => fn()).toThrow(Error)    asserts a throw
 *
 * Run: `npx vitest`        watch mode, reruns on save
 *      `npx vitest run`    once, for CI
 *
 * The thing most likely to trip you up coming back: `toBe` on two objects fails
 * even when they look identical, because it compares references. Use `toEqual`.
 */

// The two rates from the test fixture in 06-acceptance-criteria.md
const RATE_2026 = { pricePerLiter: 10000, kmPerLiter: 30 }
const RATE_2025 = { pricePerLiter: 10000, kmPerLiter: 32 }

describe('distanceKm', () => {
  it('subtracts the readings', () => {
    expect(distanceKm(13030, 13198)).toBe(168)
  })

  it('rejects an odometer that did not advance', () => {
    expect(() => distanceKm(13030, 13030)).toThrow(InvalidOdometerError)
    expect(() => distanceKm(13030, 12900)).toThrow(InvalidOdometerError)
  })

  it('rejects fractional readings', () => {
    expect(() => distanceKm(13030.5, 13198)).toThrow(InvalidOdometerError)
  })
})

describe('fuelCost', () => {
  // AC-5.1
  it('is exact when the division comes out whole', () => {
    expect(fuelCost(168, RATE_2026)).toBe(56000)
  })

  // AC-5.2 — 37 * 10000 / 30 = 12333.333...
  it('rounds down a non-terminating result', () => {
    expect(fuelCost(37, RATE_2026)).toBe(12333)
  })

  // AC-5.3 — 1 * 10000 / 32 = 312.5 exactly.
  // This is the ONLY case that exercises half-up rounding. With the 2026 rate the
  // fraction is always .000, .333 or .667, so the rule would otherwise go untested.
  it('rounds an exact half UP', () => {
    expect(fuelCost(1, RATE_2025)).toBe(313)
  })

  it('rounds another exact half up, to prove the first was not luck', () => {
    // 3 * 10000 / 32 = 937.5
    expect(fuelCost(3, RATE_2025)).toBe(938)
  })

  it('handles a fractional km per litre', () => {
    // 100 * 10000 / 32.5 = 30769.23...
    expect(fuelCost(100, { pricePerLiter: 10000, kmPerLiter: 32.5 })).toBe(30769)
  })

  it('always returns a whole rupiah integer', () => {
    for (let d = 1; d <= 500; d++) {
      const cost = fuelCost(d, RATE_2026)
      expect(Number.isInteger(cost)).toBe(true)
    }
  })

  it('rejects a rate that is not usable', () => {
    expect(() => fuelCost(10, { pricePerLiter: 0, kmPerLiter: 30 })).toThrow(InvalidRateError)
    expect(() => fuelCost(10, { pricePerLiter: 10000, kmPerLiter: 0 })).toThrow(InvalidRateError)
  })
})

describe('calculateTripFuel', () => {
  it('returns everything the trip row must snapshot', () => {
    expect(calculateTripFuel(13030, 13198, RATE_2026)).toEqual({
      distanceKm: 168,
      fuelCost: 56000,
      fuelPricePerLiter: 10000,
      fuelKmPerLiter: 30,
    })
  })

  // This is the behaviour AC-4.5 depends on. The function has no access to "the
  // current rate", so it is structurally incapable of using the wrong one. The
  // caller's job is to pass the rate effective on the trip's own date.
  it('uses the rate it was given, not any notion of a current rate', () => {
    const old = calculateTripFuel(13030, 13198, RATE_2025)
    const now = calculateTripFuel(13030, 13198, RATE_2026)
    expect(old.fuelCost).toBe(52500) // 168 * 10000 / 32
    expect(now.fuelCost).toBe(56000) // 168 * 10000 / 30
    expect(old.fuelCost).not.toBe(now.fuelCost)
  })
})
