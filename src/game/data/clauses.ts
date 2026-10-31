/**
 * Loan clauses: opt-in handicaps chosen before a run. Each one multiplies the Legacy Shards the
 * run pays out, so experienced players can trade difficulty for faster meta progress.
 */
export interface ClauseDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Added to the shard multiplier. */
  bonus: number;
}

export const CLAUSES: ClauseDef[] = [
  { id: 'usury', name: 'Usury', icon: '📈', desc: 'Installments grow 0.25× faster.', bonus: 0.3 },
  { id: 'deadline', name: 'Tight Deadline', icon: '⏰', desc: '1 day less between installments.', bonus: 0.35 },
  { id: 'frail', name: 'Frail', icon: '🩹', desc: '-3 max energy.', bonus: 0.2 },
  { id: 'taxed', name: 'Mining Tax', icon: '🧾', desc: 'Sell prices -15%.', bonus: 0.2 },
  { id: 'dry', name: 'Prohibition', icon: '🚱', desc: 'The Saloon is closed.', bonus: 0.15 },
  { id: 'cursed', name: 'Cursed Claims', icon: '🕯️', desc: 'Every claim gets +1 mutator (from Layer 4).', bonus: 0.25 },
  { id: 'puritan', name: 'Puritan', icon: '📿', desc: 'Paid installments give cash instead of artifacts.', bonus: 0.4 },
];

export const CLAUSE_MAP: Record<string, ClauseDef> = Object.fromEntries(CLAUSES.map((c) => [c.id, c]));

export const clauseBonus = (ids: readonly string[] | undefined) => (ids ?? []).reduce((s, id) => s + (CLAUSE_MAP[id]?.bonus ?? 0), 0);
