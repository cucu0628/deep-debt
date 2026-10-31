const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 10000) return sign + Math.floor(n).toLocaleString('en-US');
  let tier = Math.floor(Math.log10(n) / 3);
  tier = Math.min(tier, SUFFIX.length - 1);
  const v = n / Math.pow(1000, tier);
  return sign + v.toFixed(v < 100 ? 2 : 1) + SUFFIX[tier];
}

export const money = (n: number) => '$' + fmt(n);

export function unit(n: number): string {
  return n < 10 ? n.toFixed(2) : fmt(n);
}

export const CARD_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
