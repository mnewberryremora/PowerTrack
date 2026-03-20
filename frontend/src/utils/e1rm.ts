/**
 * Epley formula for estimated 1-rep max.
 * Returns the weight itself if reps === 1.
 */
export function epleyE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 100) / 100
}
