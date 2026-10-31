// Procedural pixel art. Every sprite is drawn into a tiny canvas once and cached;
// the renderers scale them up with nearest-neighbour filtering.

import { ORE_INFO, isOre, type Ore, type TileKind } from '../game/data/tiles';

export const T = 16;
type Pal = Record<string, string>;

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
}

function stamp(ctx: CanvasRenderingContext2D, map: string[], pal: Pal, ox = 0, oy = 0) {
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) px(ctx, ox + x, oy + y, col);
    }
  });
}

function bevel(ctx: CanvasRenderingContext2D, base: string) {
  ctx.fillStyle = shade(base, 0.18);
  ctx.fillRect(0, 0, T, 1);
  ctx.fillRect(0, 0, 1, T);
  ctx.fillStyle = shade(base, -0.35);
  ctx.fillRect(0, T - 1, T, 1);
  ctx.fillRect(T - 1, 0, 1, T);
}

function rock(ctx: CanvasRenderingContext2D, base: string, seed: number, specks: string[], n = 22, cracks = 0) {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, T, T);
  for (let k = 0; k < n; k++) {
    const x = 1 + Math.floor(r() * (T - 2));
    const y = 1 + Math.floor(r() * (T - 2));
    px(ctx, x, y, specks[k % specks.length]);
    if (r() < 0.35) px(ctx, x + 1, y, specks[k % specks.length]);
  }
  for (let c = 0; c < cracks; c++) {
    let x = 2 + Math.floor(r() * 12);
    let y = 2 + Math.floor(r() * 12);
    for (let s = 0; s < 5; s++) {
      px(ctx, x, y, shade(base, -0.4));
      x += r() < 0.5 ? 1 : 0;
      y += r() < 0.6 ? 1 : -1;
      if (x > 14 || y > 14 || y < 1) break;
    }
  }
  bevel(ctx, base);
}

const ROCK_BASE: Record<string, [string, string[], number, number]> = {
  dirt: ['#7a4a2a', ['#5e3820', '#8e5a34', '#4a2a16', '#a06a3c'], 26, 0],
  stone: ['#6e6878', ['#5a5464', '#86808f', '#4c4756'], 22, 1],
  hardrock: ['#4a4552', ['#3a3542', '#5c5766', '#2e2a35'], 26, 3],
  obsidian: ['#241a33', ['#1a1226', '#3a2c52', '#5a4880'], 14, 0],
  bedrock: ['#16141c', ['#24212c', '#0c0a10', '#2e2a38'], 30, 2],
};

const ORE_BASE = '#5b5466';

function oreSprite(ctx: CanvasRenderingContext2D, ore: Ore, seed: number) {
  rock(ctx, ORE_BASE, seed, ['#4a4455', '#6a6378'], 14, 0);
  const r = rng(seed * 7 + 3);
  const col = ore === 'coal' ? '#18161c' : ORE_INFO[ore].color;
  const hi = ore === 'coal' ? '#55525e' : shade(col, 0.55);
  const lo = ore === 'coal' ? '#0a090c' : shade(col, -0.45);
  const gem = ore === 'ruby' || ore === 'emerald' || ore === 'diamond' || ore === 'voidstone';
  const spots = [
    [2, 2],
    [9, 2],
    [2, 9],
    [10, 10],
    [6, 6],
    [11, 6],
    [5, 11],
  ];
  const count = 4 + Math.floor(r() * 2);
  for (let k = 0; k < count; k++) {
    const [bx, by] = spots[(k + Math.floor(r() * 5)) % spots.length];
    const x = bx + Math.floor(r() * 2);
    const y = by + Math.floor(r() * 2);
    if (gem) {
      // a little faceted gem
      px(ctx, x + 1, y, hi);
      px(ctx, x, y + 1, hi);
      px(ctx, x + 1, y + 1, col);
      px(ctx, x + 2, y + 1, col);
      px(ctx, x + 1, y + 2, lo);
      px(ctx, x + 2, y + 2, lo);
      px(ctx, x + 2, y, col);
      px(ctx, x, y + 2, col);
      px(ctx, x + 3, y + 1, lo);
      px(ctx, x + 1, y + 3, lo);
    } else {
      ctx.fillStyle = shade(ORE_BASE, -0.45);
      ctx.fillRect(x - 1, y, 5, 3);
      ctx.fillRect(x, y - 1, 3, 5);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 3, 3);
      px(ctx, x, y, hi);
      px(ctx, x + 1, y, hi);
      px(ctx, x, y + 1, hi);
      px(ctx, x + 2, y + 2, lo);
      px(ctx, x + 2, y + 1, lo);
      px(ctx, x + 1, y + 2, lo);
    }
  }
  if (gem) {
    // sparkle
    const x = 3 + Math.floor(r() * 10);
    const y = 3 + Math.floor(r() * 10);
    px(ctx, x, y, '#ffffff');
  }
}

// ---------- hand-drawn maps ----------

const TNT = [
  '.........y.y....',
  '..........y.....',
  '.........f......',
  '........f.......',
  '.kkkkkkkkkkkkkk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kwwwwwwwwwwwwk.',
  '.kwkwkwwkwkwwwk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kRrrdRrrdRrrdk.',
  '.kkkkkkkkkkkkkk.',
];
const CHEST = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kBBBBBBBBBBBBk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kddddddddddddk.',
  '.kgggggkkgggggk.',
  '.kGGGGkggkGGGGk.',
  '.kbbbbkGGkbbbbk.',
  '.kbbbbbkkbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kddddddddddddk.',
  '..kkkkkkkkkkkk..',
  '................',
];
const MAGNET = [
  '................',
  '..kkkk....kkkk..',
  '..ksSk....ksSk..',
  '..ksSk....ksSk..',
  '..kkkk....kkkk..',
  '..kRrk....kRrk..',
  '..kRrk....kRrk..',
  '..kRrk....kRrk..',
  '..kRrk....kRrk..',
  '..kRrrkkkkRrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrdk..',
  '...kddddddddk...',
  '....kkkkkkkk....',
  '................',
  '................',
];
const BOLT = [
  '................',
  '........kkkk....',
  '.......kYyyk....',
  '......kYyyk.....',
  '.....kYyyk......',
  '....kYyyykkkk...',
  '...kYyyyyyyyk...',
  '...kkkkkYyyk....',
  '......kYyyk.....',
  '.....kYyok......',
  '....kYyok.......',
  '...kYook........',
  '...kook.........',
  '...kkk..........',
  '................',
  '................',
];
const CRYSTAL = [
  '................',
  '.......kk.......',
  '......kCck......',
  '.....kCccbk.....',
  '....kCcccbbk....',
  '...kCccccbbbk...',
  '..kCcccccbbbbk..',
  '.kCCcccccbbbbbk.',
  '.kcccccccbbbbbk.',
  '..kcccccbbbbbk..',
  '...kccccbbbbk...',
  '....kcccbbbk....',
  '.....kccbbk.....',
  '......kcbk......',
  '.......kk.......',
  '................',
];
const MULTI = [
  '................',
  '................',
  '..kk........kk..',
  '..kPpk....kPpk..',
  '...kPpk..kPpk...',
  '....kPpkkPpk....',
  '.....kPppPk.....',
  '......kPpk......',
  '......kPpk......',
  '.....kPpppk.....',
  '....kPpkkPpk....',
  '...kPpk..kPpk...',
  '..kPpk....kPpk..',
  '..kdk......kdk..',
  '...k........k...',
  '................',
];
const RELIC = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kwwwwwwk....',
  '...kwwkkkkwwk...',
  '...kwwk..kwwk...',
  '....kk..kwwk....',
  '.......kwwk.....',
  '......kwwk......',
  '......kwwk......',
  '.......kk.......',
  '................',
  '......kkkk......',
  '......kwwk......',
  '......kkkk......',
  '................',
];
const STAIRS = [
  'gggggggggggggggg',
  'gkkkkkkkkkkkkkkg',
  'gkbbbbbbbbbbbbkg',
  'gkbhhhhhhhhhhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbhllllllllhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbhllllllllhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbhllllllllhbkg',
  'gkbhlhhhhhhlhbkg',
  'gkbbbbbbbbbbbbkg',
  'gkkkkkkkkkkkkkkg',
  'gggggggggggggggg',
];

const MINER = [
  '................',
  '.....kkkkk......',
  '....kyyyyyk.....',
  '...kyyyyyyyL....',
  '...kkkkkkkkk....',
  '....kssssk......',
  '....ksskek......',
  '....kssssk......',
  '...kbbbbbbk.....',
  '..kbbbbbbbbk....',
  '..ksbbbbbbsk....',
  '...kbbbbbbk.....',
  '...kppkkppk.....',
  '...kppk.kppk....',
  '...kddk.kddk....',
  '...kkkk.kkkk....',
];
const MINER_PAL: Pal = {
  k: '#140c10',
  y: '#ffd34d',
  L: '#fff6b0',
  s: '#f0b88a',
  e: '#140c10',
  b: '#3a6ad6',
  p: '#6a4424',
  d: '#2a1a10',
};

function special(ctx: CanvasRenderingContext2D, k: TileKind, v: number) {
  const dark = (c: string, seed: number) => rock(ctx, c, seed, [shade(c, -0.25), shade(c, 0.12)], 16, 0);
  switch (k) {
    case 'tnt':
      dark('#3a2a24', 11 + v);
      stamp(ctx, TNT, { k: '#140c10', R: '#ff6a55', r: '#d0281e', d: '#8a1810', w: '#f2e6c8', y: '#ffe066', f: '#7a6040' });
      break;
    case 'chest':
      dark('#33282e', 13 + v);
      stamp(ctx, CHEST, { k: '#140c10', B: '#c8843e', b: '#94582a', d: '#5a3418', g: '#ffd34d', G: '#c8961e' });
      break;
    case 'magnet':
      dark('#2e2a36', 17 + v);
      stamp(ctx, MAGNET, { k: '#140c10', s: '#eef1f6', S: '#9aa0ac', R: '#ff6a6a', r: '#d63a3a', d: '#8a1a1a' });
      break;
    case 'energy':
      dark('#3a3418', 19 + v);
      stamp(ctx, BOLT, { k: '#2a2008', Y: '#fff6b0', y: '#ffe14d', o: '#c8961e' });
      break;
    case 'crystal':
      dark('#183440', 23 + v);
      stamp(ctx, CRYSTAL, { k: '#0a2a38', C: '#e0fbff', c: '#6fe3ff', b: '#2a8aa8' });
      break;
    case 'multi':
      dark('#3b1a5a', 29 + v);
      stamp(ctx, MULTI, { k: '#1a0628', P: '#ffe0ff', p: '#d68bff', d: '#7a2aa8' });
      break;
    case 'relic':
      dark('#5a4a32', 31 + v);
      stamp(ctx, RELIC, { k: '#3a2810', w: '#fff0c2' });
      break;
    case 'stairs':
      stamp(ctx, STAIRS, { g: v === 1 ? '#8cc8ff' : '#4f8fe0', k: '#0a1020', b: '#8a5426', h: '#060a16', l: '#c89a5a' });
      break;
    case 'gas': {
      dark('#2f4a1a', 37);
      const r = rng(41 + v);
      for (let n = 0; n < 4; n++) {
        const cx = 3 + Math.floor(r() * 10);
        const cy = 11 - v * 2 - n * 2 + Math.floor(r() * 3);
        const rad = 1 + (n % 2);
        ctx.fillStyle = '#9be05a';
        ctx.fillRect(cx - rad, cy - rad + 1, rad * 2 + 1, rad * 2 - 1);
        ctx.fillRect(cx - rad + 1, cy - rad, rad * 2 - 1, rad * 2 + 1);
        px(ctx, cx - rad + 1, cy - rad + 1, '#e4ffc4');
      }
      bevel(ctx, '#2f4a1a');
      break;
    }
    case 'lava': {
      ctx.fillStyle = '#b8360c';
      ctx.fillRect(0, 0, T, T);
      const r = rng(53 + v * 5);
      for (let n = 0; n < 9; n++) {
        const x = Math.floor(r() * 14);
        const y = Math.floor(r() * 14);
        ctx.fillStyle = n < 3 ? '#ffe066' : '#ff8a2a';
        ctx.fillRect(x, y, 2 + (n % 2), 2);
      }
      ctx.fillStyle = '#7a1e06';
      for (let n = 0; n < 6; n++) ctx.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1);
      bevel(ctx, '#d04a14');
      break;
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** Animated kinds have 3 frames; everything else has 3 visual variants. */
export function tileSprite(k: TileKind, v: number): HTMLCanvasElement {
  const key = `${k}:${v}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, ctx] = mk(T, T);
  if (isOre(k)) oreSprite(ctx, k, 100 + v * 31 + k.length * 7);
  else if (k in ROCK_BASE) {
    const [base, specks, n, cracks] = ROCK_BASE[k];
    rock(ctx, base, 7 + v * 13 + k.length, specks, n, cracks);
  } else special(ctx, k, v);
  cache.set(key, cv);
  return cv;
}

export function fogSprite(v: number): HTMLCanvasElement {
  const key = `fog:${v}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, ctx] = mk(T, T);
  rock(ctx, '#171120', 900 + v, ['#1f1829', '#110c18', '#241c30'], 16, 0);
  cache.set(key, cv);
  return cv;
}

export function emptySprite(bg: string, v: number): HTMLCanvasElement {
  const key = `empty:${bg}:${v}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, ctx] = mk(T, T);
  const base = shade(bg, -0.35);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, T, T);
  const r = rng(500 + v);
  for (let n = 0; n < 7; n++) px(ctx, Math.floor(r() * T), Math.floor(r() * T), shade(bg, -0.1));
  for (let n = 0; n < 4; n++) px(ctx, Math.floor(r() * T), Math.floor(r() * T), shade(bg, -0.6));
  cache.set(key, cv);
  return cv;
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(ctx, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export const MINER_W = 24;
export const MINER_H = 20;

/** frame 0: rest, 1: raised, 2: strike. The body sits at (4,4) inside a 24x20 canvas. */
export function minerSprite(frame: 0 | 1 | 2): HTMLCanvasElement {
  const key = `miner:${frame}`;
  let c = cache.get(key);
  if (c) return c;
  const [cv, ctx] = mk(MINER_W, MINER_H);
  const angle = [-100, -150, 35][frame] * (Math.PI / 180);
  const hx = 14;
  const hy = 14;
  const ex = hx + Math.cos(angle) * 8;
  const ey = hy + Math.sin(angle) * 8;
  const draw = () => {
    line(ctx, hx, hy, ex, ey, '#8a5426');
    const pa = angle + Math.PI / 2;
    line(ctx, ex - Math.cos(pa) * 3, ey - Math.sin(pa) * 3, ex + Math.cos(pa) * 3, ey + Math.sin(pa) * 3, '#c8ccd6');
    px(ctx, Math.round(ex - Math.cos(pa) * 3), Math.round(ey - Math.sin(pa) * 3), '#6a6e78');
  };
  if (frame === 1) draw();
  stamp(ctx, MINER, MINER_PAL, 4, 4);
  if (frame !== 1) draw();
  cache.set(key, cv);
  return cv;
}

// ---------- icons for the DOM ----------

const urlCache = new Map<string, string | null>();

export function tileIconURL(k: TileKind): string {
  const key = `tile:${k}`;
  if (!urlCache.has(key)) urlCache.set(key, tileSprite(k, 0).toDataURL());
  return urlCache.get(key)!;
}

export function minerIconURL(): string {
  if (!urlCache.has('miner')) urlCache.set('miner', minerSprite(0).toDataURL());
  return urlCache.get('miner')!;
}

/** Renders an emoji at 16px, hardens its alpha and adds a dark pixel outline, so every icon reads as pixel art. */
export function emojiIconURL(emoji: string): string | null {
  const key = `emoji:${emoji}`;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const S = 18;
  const [cv, ctx] = mk(S, S);
  ctx.font = '13px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, S / 2, S / 2 + 1);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  let any = false;
  const solid = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) {
    if (d[i * 4 + 3] > 110) {
      d[i * 4 + 3] = 255;
      solid[i] = 1;
      any = true;
    } else d[i * 4 + 3] = 0;
  }
  if (!any) {
    urlCache.set(key, null);
    return null;
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (solid[i]) continue;
      const near = (x > 0 && solid[i - 1]) || (x < S - 1 && solid[i + 1]) || (y > 0 && solid[i - S]) || (y < S - 1 && solid[i + S]);
      if (near) {
        d[i * 4] = 16;
        d[i * 4 + 1] = 10;
        d[i * 4 + 2] = 20;
        d[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}
