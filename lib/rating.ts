// Blend a player's self-rating with an earned rating derived from match points.
// Earned ratings arrive in the next build; until then `earned` is null and the
// blended value is just the self-rating.
export function selfWeight(matchesPlayed: number): number {
  return Math.min(1, Math.max(0.15, 1 - matchesPlayed / 12));
}

export function blendedRating(
  self: number,
  earned: number | null,
  matchesPlayed: number
): number {
  if (earned == null) return self;
  const w = selfWeight(matchesPlayed);
  return w * self + (1 - w) * earned;
}
