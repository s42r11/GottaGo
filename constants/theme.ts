export const Colors = {
  bg: '#0b0b0d',
  surface: '#161618',
  surfaceInput: '#0b0b0d',
  border: '#27272a',
  borderStrong: '#3f3f46',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  textFainter: '#52525b',
  brand: '#f5ea42',
  brandTintBg: '#2a2410',
  onBrand: '#0b0b0d',
};

export function getRatingColor(score: number): string {
  if (score === 0) return '#71717a';
  if (score >= 4.0) return '#34d399';
  if (score >= 3.0) return '#fbbf24';
  return '#f87171';
}

export function getRatingLabel(score: number): string {
  if (score === 0) return 'New';
  if (score >= 4.5) return 'Spotless';
  if (score >= 4.0) return 'Great';
  if (score >= 3.5) return 'Decent';
  if (score >= 3.0) return 'Decent';
  return 'Rough';
}
