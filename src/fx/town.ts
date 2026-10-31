import { MINER_H, MINER_W, minerSprite, shade } from './sprites';

// The town is a 320×180 pixel scene. Buildings are drawn with plain rects at that resolution
// and the canvas is scaled up, so it reads as hand-made pixel art.

export type BuildingId = 'mine' | 'market' | 'shop' | 'saloon' | 'company';

interface Building {
  id: BuildingId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  door: number;
}

export const BUILDINGS: Building[] = [
  { id: 'mine', x: 2, y: 70, w: 74, h: 68, label: 'MINE', door: 38 },
  { id: 'market', x: 80, y: 90, w: 52, h: 48, label: 'MARKET', door: 106 },
  { id: 'shop', x: 136, y: 70, w: 52, h: 68, label: 'TOOL SHOP', door: 162 },
  { id: 'saloon', x: 192, y: 60, w: 60, h: 78, label: 'SALOON', door: 222 },
  { id: 'company', x: 256, y: 64, w: 62, h: 74, label: 'THE COMPANY', door: 287 },
];

const W = 320;
const H = 180;
const GROUND = 138;
const FONT = '"Press Start 2P", monospace';

export interface TownState {
  evening: boolean;
  urgent: boolean;
  canDig: boolean;
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
}

export class TownScene {
  private c: CanvasRenderingContext2D;
  scale = 3;
  hover: BuildingId | null = null;
  private puffs: Puff[] = [];
  private minerX = 150;
  private minerTarget = 150;
  private face = 1;
  private lastPuff = 0;
  private texts: { x: number; y: number; text: string; color: string; life: number }[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.c = canvas.getContext('2d')!;
  }

  resize(availW: number, availH: number) {
    const fit = Math.min(availW / W, availH / H);
    this.scale = fit >= 2 ? Math.floor(fit) : Math.max(1, fit);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${W * this.scale}px`;
    this.canvas.style.height = `${H * this.scale}px`;
    this.canvas.width = Math.round(W * this.scale * dpr);
    this.canvas.height = Math.round(H * this.scale * dpr);
    this.c.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
    this.c.imageSmoothingEnabled = false;
  }

  hit(px: number, py: number): BuildingId | null {
    const x = px / this.scale;
    const y = py / this.scale;
    const b = BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < GROUND + 4);
    return b?.id ?? null;
  }

  walkTo(id: BuildingId) {
    this.minerTarget = BUILDINGS.find((b) => b.id === id)!.door;
  }

  floatText(id: BuildingId, text: string, color: string) {
    const b = BUILDINGS.find((x) => x.id === id)!;
    this.texts.push({ x: b.x + b.w / 2, y: b.y - 6, text, color, life: 0 });
  }

  frame(now: number, dt: number, st: TownState) {
    const c = this.c;
    // miner walk
    const dx = this.minerTarget - this.minerX;
    if (Math.abs(dx) > 0.5) {
      this.face = dx > 0 ? 1 : -1;
      this.minerX += Math.sign(dx) * Math.min(Math.abs(dx), 90 * dt);
    }
    // smoke & notes
    if (now - this.lastPuff > 260) {
      this.lastPuff = now;
      this.puffs.push({ x: 176 + Math.random() * 2, y: 68, vx: 3 + Math.random() * 3, vy: -8, life: 0, max: 2.4, size: 2 + Math.floor(Math.random() * 2), color: st.evening ? '#6a5a7a' : '#d8dce6' });
      if (st.evening && Math.random() < 0.4)
        this.puffs.push({ x: 228 + Math.random() * 10, y: 112, vx: (Math.random() - 0.5) * 6, vy: -10, life: 0, max: 1.8, size: 0, color: '#ffd34d', text: Math.random() < 0.5 ? '♪' : '♫' });
    }
    for (const p of this.puffs) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.puffs = this.puffs.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y -= 8 * dt;
    }
    this.texts = this.texts.filter((t) => t.life < 2.2);

    c.save();
    c.clearRect(0, 0, W, H);
    this.sky(now, st.evening);
    this.hills(st.evening);
    this.ground();
    this.mine(now, st);
    this.market(st);
    this.shop(st);
    this.saloon(now, st);
    this.company(now, st);
    this.lampposts(now, st.evening);
    for (const p of this.puffs) {
      c.globalAlpha = 1 - p.life / p.max;
      if (p.text) this.text(p.text, p.x, p.y, p.color, 6);
      else {
        c.fillStyle = p.color;
        c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    c.globalAlpha = 1;
    this.drawMiner(now);
    if (st.canDig) this.bubble(38, 66 + (Math.floor(now / 300) % 2), 'DIG!', '#ffd34d');
    if (st.urgent) this.bubble(287, 56 + (Math.floor(now / 200) % 2), 'PAY!', '#ff5050');
    if (this.hover) this.highlight(this.hover, now);
    for (const t of this.texts) {
      c.globalAlpha = t.life > 1.6 ? (2.2 - t.life) / 0.6 : 1;
      this.text(t.text, t.x, Math.round(t.y), t.color, 8);
    }
    c.globalAlpha = 1;
    c.restore();
  }

  // ---------- helpers ----------

  private r(x: number, y: number, w: number, h: number, col: string) {
    this.c.fillStyle = col;
    this.c.fillRect(x, y, w, h);
  }

  private text(s: string, x: number, y: number, col: string, size = 6, align: CanvasTextAlign = 'center') {
    const c = this.c;
    c.font = `${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = '#140c10';
    c.fillText(s, x + 1, y + 1);
    c.fillText(s, x - 1, y);
    c.fillText(s, x + 1, y);
    c.fillText(s, x, y - 1);
    c.fillStyle = col;
    c.fillText(s, x, y);
  }

  private bubble(x: number, y: number, s: string, col: string) {
    const c = this.c;
    c.font = `6px ${FONT}`;
    const w = Math.ceil(c.measureText(s).width) + 6;
    const bx = Math.round(x - w / 2);
    this.r(bx - 1, y - 6, w + 2, 11, '#140c10');
    this.r(bx, y - 7, w, 13, '#140c10');
    this.r(bx, y - 6, w, 11, col);
    this.r(x - 2, y + 5, 4, 2, '#140c10');
    this.r(x - 1, y + 7, 2, 1, '#140c10');
    c.fillStyle = '#140c10';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }

  private highlight(id: BuildingId, now: number) {
    const b = BUILDINGS.find((x) => x.id === id)!;
    const bob = Math.floor(now / 250) % 2;
    const c = this.c;
    c.fillStyle = '#ffffff';
    const x0 = b.x - 2 - bob;
    const y0 = b.y - 2 - bob;
    const x1 = b.x + b.w + 1 + bob;
    const y1 = GROUND + 2 + bob;
    const L = 6;
    for (const [x, y, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ]) {
      c.fillRect(sx > 0 ? x : x - L + 1, y, L, 1);
      c.fillRect(x, sy > 0 ? y : y - L + 1, 1, L);
    }
    c.font = `8px ${FONT}`;
    const w = Math.ceil(c.measureText(b.label).width) + 8;
    const lx = Math.max(2, Math.min(W - w - 2, Math.round(b.x + b.w / 2 - w / 2)));
    const ly = Math.max(2, b.y - 18);
    this.r(lx - 1, ly - 1, w + 2, 14, '#140c10');
    this.r(lx, ly, w, 12, '#2b2134');
    this.r(lx, ly, w, 1, '#4a3a58');
    this.text(b.label, lx + w / 2, ly + 6, '#ffd34d', 8);
  }

  private sky(now: number, evening: boolean) {
    const bands = evening ? ['#1e1238', '#2e1a4e', '#4e2660', '#7a3462', '#b04a5a', '#e07a52'] : ['#3a78dc', '#4a88e6', '#5c9aee', '#72adf6', '#8cc0fc', '#a8d4ff'];
    bands.forEach((col, k) => this.r(0, k * 20, W, 21, col));
    if (evening) {
      for (let k = 0; k < 30; k++) {
        const x = (k * 97) % W;
        const y = (k * 53) % 70;
        if ((Math.floor(now / 500) + k) % 7) this.r(x, y, 1, 1, '#ffffff');
      }
      this.r(276, 14, 12, 12, '#f4ecd0');
      this.r(274, 16, 16, 8, '#f4ecd0');
      this.r(280, 16, 3, 3, '#d8ccaa');
      this.r(284, 21, 2, 2, '#d8ccaa');
    } else {
      this.r(30, 16, 14, 14, '#fff3a0');
      this.r(28, 18, 18, 10, '#fff3a0');
      this.r(32, 18, 10, 10, '#ffe066');
      const drift = (now / 300) % (W + 60);
      for (const [ox, oy, s] of [
        [0, 22, 1],
        [140, 12, 1.4],
        [240, 30, 0.8],
      ]) {
        const x = Math.round(((ox + drift * s) % (W + 60)) - 30);
        this.r(x, oy, 22, 4, '#ffffff');
        this.r(x + 4, oy - 3, 12, 3, '#ffffff');
        this.r(x + 2, oy + 4, 18, 1, '#d8e8ff');
      }
      const bx = Math.round(((now / 60) % (W + 40)) - 20);
      this.r(bx, 40, 1, 1, '#2a2a3a');
      this.r(bx + 1, 41, 1, 1, '#2a2a3a');
      this.r(bx + 2, 40, 1, 1, '#2a2a3a');
    }
  }

  private hills(evening: boolean) {
    const far = evening ? '#3a2a5a' : '#7a92c8';
    const near = evening ? '#22243a' : '#4f8a62';
    for (let x = 0; x < W; x++) {
      const h1 = Math.round(84 - 16 * Math.abs(Math.sin(x / 41)) - 8 * Math.sin(x / 13 + 1));
      this.r(x, h1, 1, GROUND - h1, far);
      if (!evening && h1 < 74) this.r(x, h1, 1, 2, '#e8f0ff');
      const h2 = Math.round(112 - 8 * Math.abs(Math.sin(x / 23 + 2)) - 3 * Math.sin(x / 7));
      this.r(x, h2, 1, GROUND - h2, near);
    }
  }

  private ground() {
    this.r(0, GROUND, W, H - GROUND, '#6a4226');
    this.r(0, GROUND, W, 3, '#3fa34d');
    this.r(0, GROUND, W, 1, '#6fe07a');
    this.r(0, 150, W, 18, '#a87e4c');
    this.r(0, 150, W, 1, '#c8a06a');
    this.r(0, 167, W, 1, '#7a5430');
    for (let x = 3; x < W; x += 11) {
      this.r(x, 155 + (x % 3), 4, 1, '#94693c');
      this.r(x + 5, 172 + (x % 4), 2, 1, '#4e2e18');
    }
  }

  private lampposts(now: number, evening: boolean) {
    for (const x of [78, 134, 190, 254]) {
      this.r(x, 120, 2, 30, '#2a2230');
      this.r(x - 2, 118, 6, 3, '#2a2230');
      this.r(x - 1, 114, 4, 4, evening ? '#ffe066' : '#c8c0a0');
      if (evening) {
        this.c.globalAlpha = 0.18 + 0.05 * Math.sin(now / 300 + x);
        this.r(x - 7, 110, 16, 12, '#ffd34d');
        this.c.globalAlpha = 1;
      }
    }
  }

  private mine(now: number, st: TownState) {
    for (let x = 0; x < 82; x++) {
      const top = Math.round(74 + Math.pow(x - 38, 2) / 26);
      if (top >= GROUND) continue;
      this.r(x, top, 1, GROUND - top, '#6a4a2c');
      this.r(x, top, 1, 2, '#3fa34d');
      if ((x * 7) % 9 === 0) this.r(x, top + 6 + (x % 13), 2, 1, '#54381e');
    }
    // entrance
    this.r(22, 102, 32, 36, '#0a0608');
    this.r(24, 104, 28, 6, '#16101a');
    this.r(20, 98, 4, 40, '#8a5426');
    this.r(52, 98, 4, 40, '#8a5426');
    this.r(20, 98, 1, 40, '#b07038');
    this.r(52, 98, 1, 40, '#b07038');
    this.r(17, 96, 42, 5, '#8a5426');
    this.r(17, 96, 42, 1, '#b07038');
    // sign
    this.r(26, 86, 24, 9, '#140c10');
    this.r(27, 87, 22, 7, '#c8843e');
    this.text('MINE', 38, 91, '#fff4e0', 5);
    // rails
    this.r(24, 136, 56, 1, '#8a8e98');
    this.r(24, 133, 50, 1, '#8a8e98');
    for (let x = 26; x < 78; x += 5) this.r(x, 133, 2, 4, '#5a3418');
    // minecart
    const ores = ['#e08a4f', '#ffd34d', '#e9f0f7', '#ff2f6d'];
    this.r(56, 124, 16, 9, '#140c10');
    this.r(57, 125, 14, 7, '#6e6878');
    this.r(57, 125, 14, 1, '#9a94a4');
    ores.forEach((col, k) => this.r(58 + k * 3, 122 - (k % 2), 3, 3, col));
    this.r(58, 132, 3, 3, '#140c10');
    this.r(67, 132, 3, 3, '#140c10');
    // lantern
    const glow = 0.5 + 0.5 * Math.sin(now / 250);
    this.c.globalAlpha = st.evening ? 0.3 + glow * 0.1 : 0.12;
    this.r(9, 104, 12, 12, '#ffd34d');
    this.c.globalAlpha = 1;
    this.r(14, 108, 3, 4, '#ffe066');
    this.r(14, 106, 3, 1, '#2a2230');
  }

  private market(st: TownState) {
    const x = 80;
    this.r(x + 2, 102, 3, 36, '#6a4424');
    this.r(x + 47, 102, 3, 36, '#6a4424');
    for (let k = 0; k < 9; k++) {
      const col = k % 2 ? '#f2e6c8' : '#d0362e';
      this.r(x + k * 6 - 1, 92, 6, 10, col);
      this.r(x + k * 6 - 1, 102, 6, 2, k % 2 ? '#c8bca0' : '#9a2620');
      this.r(x + k * 6 + 1, 104, 2, 1, k % 2 ? '#c8bca0' : '#9a2620');
    }
    this.r(x - 1, 91, 54, 1, '#140c10');
    this.r(x, 118, 52, 20, '#94582a');
    this.r(x, 118, 52, 2, '#c8843e');
    this.r(x, 126, 52, 1, '#6a3c1a');
    // ore piles
    const piles: [number, string][] = [
      [6, '#3a3640'],
      [20, '#e08a4f'],
      [34, '#ffd34d'],
    ];
    for (const [ox, col] of piles) {
      this.r(x + ox, 114, 10, 4, col);
      this.r(x + ox + 2, 112, 6, 2, col);
      this.r(x + ox + 3, 112, 2, 1, shade(col, 0.5));
    }
    this.r(x + 13, 106, 26, 8, '#140c10');
    this.r(x + 14, 107, 24, 6, st.evening ? '#e0b060' : '#f2e6c8');
    this.text('$$$', x + 26, 110, '#2a8a3a', 5);
  }

  private shop(st: TownState) {
    const x = 136;
    for (let y = 92; y < GROUND; y += 4) this.r(x, y, 52, 4, (y / 4) % 2 ? '#7a4a24' : '#8a5a30');
    this.r(x, 92, 1, 46, '#a06a34');
    // roof
    for (let k = 0; k < 11; k++) this.r(x - 4 + k * 2, 90 - k * 2, 60 - k * 4, 2, k % 2 ? '#8a2a2a' : '#a03434');
    this.r(x + 38, 66, 6, 14, '#5a4a52');
    this.r(x + 37, 65, 8, 2, '#3a2e36');
    // window & door
    this.r(x + 5, 100, 14, 12, '#140c10');
    this.r(x + 6, 101, 12, 10, st.evening ? '#ffd34d' : '#9ccaff');
    this.r(x + 11, 101, 1, 10, '#140c10');
    this.r(x + 6, 105, 12, 1, '#140c10');
    this.r(x + 24, 114, 14, 24, '#140c10');
    this.r(x + 25, 115, 12, 23, '#4a2a14');
    this.r(x + 34, 126, 2, 2, '#ffd34d');
    // sign: pickaxe
    this.r(x + 40, 100, 11, 10, '#140c10');
    this.r(x + 41, 101, 9, 8, '#c8843e');
    for (let k = 0; k < 6; k++) this.r(x + 42 + k, 107 - k, 1, 1, '#5a3418');
    this.r(x + 44, 102, 5, 1, '#d0d4dc');
    this.r(x + 48, 103, 1, 2, '#d0d4dc');
    this.r(x + 43, 103, 1, 1, '#d0d4dc');
  }

  private saloon(now: number, st: TownState) {
    const x = 192;
    this.r(x, 78, 60, 60, '#a0663a');
    for (let y = 80; y < GROUND; y += 5) this.r(x, y, 60, 1, '#8a5430');
    // false front
    this.r(x + 4, 62, 52, 16, '#a0663a');
    this.r(x + 8, 58, 44, 4, '#a0663a');
    this.r(x + 4, 62, 52, 1, '#c8844e');
    this.r(x + 7, 65, 46, 10, '#140c10');
    this.r(x + 8, 66, 44, 8, '#3a1a10');
    this.text('SALOON', x + 30, 70, '#ffd34d', 6);
    // balcony
    this.r(x - 2, 96, 64, 3, '#5a3418');
    for (let k = 0; k < 16; k++) this.r(x + k * 4, 90, 1, 6, '#5a3418');
    this.r(x - 2, 89, 64, 1, '#5a3418');
    const lit = st.evening && Math.floor(now / 700) % 5 !== 0 ? '#ffd34d' : st.evening ? '#e8b030' : '#9ccaff';
    for (const wx of [8, 40]) {
      this.r(x + wx, 80, 12, 9, '#140c10');
      this.r(x + wx + 1, 81, 10, 8, lit);
      this.r(x + wx, 108, 12, 12, '#140c10');
      this.r(x + wx + 1, 109, 10, 10, lit);
    }
    // batwing doors
    this.r(x + 22, 112, 16, 26, '#1a0e08');
    const swing = Math.floor(now / 400) % 2;
    this.r(x + 23, 118, 6 - swing, 12, '#c8843e');
    this.r(x + 31 + swing, 118, 6 - swing, 12, '#c8843e');
    this.r(x + 23, 120, 6 - swing, 1, '#8a5430');
    this.r(x + 31 + swing, 120, 6 - swing, 1, '#8a5430');
  }

  private company(now: number, st: TownState) {
    const x = 256;
    this.r(x + 2, 86, 58, 52, '#8a8a9a');
    for (let y = 88; y < GROUND; y += 6) {
      this.r(x + 2, y, 58, 1, '#74748a');
      for (let k = (y / 6) % 2 ? 0 : 6; k < 58; k += 12) this.r(x + 2 + k, y, 1, 6, '#74748a');
    }
    // pediment
    for (let k = 0; k < 9; k++) this.r(x + k * 3, 84 - k * 2, 62 - k * 6, 2, k % 2 ? '#a4a4b4' : '#b4b4c4');
    this.r(x, 84, 62, 3, '#c8c8d4');
    this.text('$', x + 31, 77, '#ffd34d', 7);
    // columns
    for (const cx of [6, 18, 38, 50]) {
      this.r(x + cx, 90, 6, 44, '#d0d0dc');
      this.r(x + cx, 90, 1, 44, '#f0f0f8');
      this.r(x + cx + 5, 90, 1, 44, '#9a9aaa');
      this.r(x + cx - 1, 88, 8, 2, '#e0e0ea');
    }
    this.r(x + 26, 108, 10, 26, '#2a1a20');
    this.r(x + 30, 120, 2, 2, '#ffd34d');
    this.r(x, 134, 62, 4, '#a4a4b4');
    this.r(x + 2, 132, 58, 2, '#b8b8c8');
    // banner
    const red = st.urgent && Math.floor(now / 250) % 2 === 0;
    this.r(x + 12, 94, 4, 12, red ? '#ff3040' : '#7a1a2a');
    this.r(x + 46, 94, 4, 12, red ? '#ff3040' : '#7a1a2a');
    if (st.evening) {
      this.c.globalAlpha = 0.25;
      this.r(x + 24, 104, 14, 30, '#ffd34d');
      this.c.globalAlpha = 1;
    }
  }

  private drawMiner(now: number) {
    const c = this.c;
    const walking = Math.abs(this.minerTarget - this.minerX) > 0.5;
    const x = Math.round(this.minerX - 8);
    const y = 150 + (walking && Math.floor(now / 120) % 2 ? -1 : 0);
    c.save();
    if (this.face < 0) {
      c.translate(x + 8, 0);
      c.scale(-1, 1);
      c.translate(-(x + 8), 0);
    }
    c.drawImage(minerSprite(0), x - 4, y - 4, MINER_W, MINER_H);
    c.restore();
  }
}
