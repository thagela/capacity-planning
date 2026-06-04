/** Color class for leftover-capacity %: too low (overcommitted) → bad, healthy → good, too high (underused) → warn. */
export function leftoverClass(pct: number): string {
  if (pct < 5) return 'pct-bad';
  if (pct > 25) return 'pct-warn';
  return 'pct-good';
}

export function leftoverLabel(pct: number): string {
  if (pct < 0) return 'Overcommitted';
  if (pct < 5) return 'At capacity';
  if (pct > 25) return 'Under-utilised';
  return 'Healthy';
}

export const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : (Math.round(n * 10) / 10).toString();

export const pct = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : `${Math.round(n * 10) / 10}%`;
