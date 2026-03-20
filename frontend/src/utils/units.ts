const LBS_PER_KG = 2.20462

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / LBS_PER_KG) * 100) / 100
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * LBS_PER_KG * 100) / 100
}

export function formatWeight(lbs: number, unit: 'lbs' | 'kg'): string {
  if (unit === 'kg') {
    return `${lbsToKg(lbs).toFixed(1)} kg`
  }
  return `${lbs.toFixed(1)} lbs`
}
