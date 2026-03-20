/**
 * DOTS coefficient calculation for powerlifting.
 * Uses the official IPF DOTS formula coefficients.
 */

const MALE_COEFFS = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
const FEMALE_COEFFS = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]

function dotsCoefficient(bodyweightKg: number, coeffs: number[]): number {
  const bw = Math.min(Math.max(bodyweightKg, 40), 210)
  const denominator =
    coeffs[0] +
    coeffs[1] * bw +
    coeffs[2] * bw ** 2 +
    coeffs[3] * bw ** 3 +
    coeffs[4] * bw ** 4
  return 500 / denominator
}

export function calculateDots(
  totalKg: number,
  bodyweightKg: number,
  isMale: boolean = true
): number {
  if (totalKg <= 0 || bodyweightKg <= 0) return 0
  const coeffs = isMale ? MALE_COEFFS : FEMALE_COEFFS
  const coefficient = dotsCoefficient(bodyweightKg, coeffs)
  return Math.round(totalKg * coefficient * 100) / 100
}
