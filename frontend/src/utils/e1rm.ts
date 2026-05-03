/**
 * Epley formula for estimated 1-rep max.
 * For bodyweight exercises with a known bodyweight, Epley is applied to
 * (bodyweight + listed weight) and bodyweight is subtracted, so the result
 * stays in the same units the user entered (added weight; 0 = bodyweight-only).
 */
export function epleyE1RM(
  weight: number,
  reps: number,
  options?: { isBodyweight?: boolean; bodyweight?: number },
): number {
  if (reps <= 0) return 0
  const bw = options?.isBodyweight && options.bodyweight && options.bodyweight > 0
    ? options.bodyweight
    : 0
  const total = bw + weight
  if (total <= 0) return 0
  if (reps === 1) return Math.round(weight * 100) / 100
  const e1rm = total * (1 + reps / 30) - bw
  return Math.round(e1rm * 100) / 100
}
