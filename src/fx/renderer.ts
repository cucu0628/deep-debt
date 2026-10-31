import { biomeFor } from '../game/data/biomes';
import { RELIC_MAP } from '../game/data/relics';
import { ORE_INFO, ORES, TILE_INFO, isOre, type Ore, type TileKind } from '../game/data/tiles';
import type { ToolId } from '../game/data/upgrades';
import { SCAN_R, canDig, type ChainResult, type MineState } from '../game/mine';
import { sfx } from './audio';
import { MINER_H, MINER_W, T, emptySprite, fogSprite, minerSprite, shade, tileSprite } from './sprites';

// Everything below is in logical pixels: one tile is 16 of them. The canvas transform scales
// them up by an integer factor so the art stays crisp.

const SURF = 24;
const FONT = '"Press Start 2P", monospace';
const ANIMATED = new Set<TileKind>(['lava', 'gas', 'stairs']);

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  vy: number;
  pop: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
}

interface Beam {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  max: number;
}

export interface Preview {
  tool: ToolId | null;
  blast: number;
}

const hash = (i: number, n: number) => {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export function tileColor(k: TileKind): string {
  if (k === 'empty') return '#000';
  if (k === 'coal') return '#3a3640';
  return isOre(k) ? ORE_INFO[k].color : TILE_INFO[k].color;
}

export function comboColor(n: number): string {
  if (n < 5) return '#fff4e0';
  if (n < 12) return '#ffd34d';
  if (n < 25) return '#ff8a3d';
  if (n < 45) return '#ff3d81';
  return '#c77dff';
}

export class MineRenderer {
  private c: CanvasRenderingContext2D;
  scale = 4;
  w = 9;
  h = 9;
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private shake = 0;
  private flash = 0;
  private flashColor = '#fff';
  private ghosts = new Map<number, { k: TileKind; until: number }>();
  private revealAt = new Map<number, number>();
  private squash = new Map<number, number>();
  private timeline: { at: number; fn: () => void }[] = [];
  private live = 0;
  private miner = { col: 4, row: -1, fromCol: 4, fromRow: -1, moveAt: 0, swingAt: -1e9, face: 1 };
  busyUntil = 0;
  hover = -1;
  onCombo: (n: number) => void = () => {};

  constructor(public canvas: HTMLCanvasElement) {
    this.c = canvas.getContext('2d')!;
  }

  get W() {
    return this.w * T;
  }

  get H() {
    return SURF + this.h * T;
  }

  resize(availW: number, availH: number, w: number, h: number) {
    if (w !== this.w) {
      this.miner.col = this.miner.fromCol = Math.floor(w / 2);
      this.miner.row = this.miner.fromRow = -1;
    }
    this.w = w;
    this.h = h;
    const fit = Math.min(availW / this.W, availH / this.H);
    this.scale = fit >= 2 ? Math.floor(fit) : Math.max(1, fit);
    const dpr = window.devicePixelRatio || 1;
    const cw = this.W * this.scale;
    const ch = this.H * this.scale;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.c.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
    this.c.imageSmoothingEnabled = false;
  }

  busy(now: number) {
    return now < this.busyUntil;
  }

  /** CSS pixel coordinates relative to the canvas → cell index. */
  cellAt(px: number, py: number): number {
    const x = Math.floor(px / this.scale / T);
    const y = Math.floor((py / this.scale - SURF) / T);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  private cx(i: number) {
    return (i % this.w) * T + T / 2;
  }

  private cy(i: number) {
    return SURF + Math.floor(i / this.w) * T + T / 2;
  }

  private later(at: number, fn: () => void) {
    this.timeline.push({ at, fn });
  }

  // ---------- effects ----------

  burst(x: number, y: number, color: string, n: number, speed = 1, spark = false) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = (15 + Math.random() * 45) * speed;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 25 * speed,
        life: 0,
        max: 0.4 + Math.random() * 0.5,
        size: spark ? 1 : 1 + Math.round(Math.random() * 1.4),
        color,
        g: spark ? -10 : 170,
      });
    }
  }

  burstAt(i: number, color: string, n: number, speed = 1, spark = false) {
    this.burst(this.cx(i), this.cy(i), color, n, speed, spark);
  }

  text(x: number, y: number, text: string, color: string, size = 8, max = 1.1, vy = -10) {
    this.texts.push({ x, y, text, color, size, life: 0, max, vy, pop: 0 });
  }

  ring(i: number, r1: number, color: string, max = 0.45, r0 = 0) {
    this.rings.push({ x: this.cx(i), y: this.cy(i), r0, r1, life: 0, max, color });
  }

  private moveMiner(col: number, row: number, now: number) {
    const m = this.miner;
    if (m.col === col && m.row === row) return;
    m.fromCol = m.col;
    m.fromRow = m.row;
    m.col = col;
    m.row = row;
    m.moveAt = now;
  }

  /** Puts the miner on open ground next to the tile they are hitting, facing it. */
  private approach(target: number, beforeEmpty: boolean[], now: number) {
    const tx = target % this.w;
    const ty = Math.floor(target / this.w);
    const ok = (x: number, y: number) => {
      if (y === -1) return x >= 0 && x < this.w && ty === 0;
      return x >= 0 && y >= 0 && x < this.w && y < this.h && beforeEmpty[y * this.w + x];
    };
    const spots: [number, number][] = [
      [tx, ty - 1],
      [tx - 1, ty],
      [tx + 1, ty],
      [tx, ty + 1],
    ];
    const m = this.miner;
    const here = spots.find(([x, y]) => x === m.col && y === m.row && ok(x, y));
    const spot = here ?? spots.find(([x, y]) => ok(x, y));
    if (spot) this.moveMiner(spot[0], spot[1], now);
    if (tx > m.col) m.face = 1;
    else if (tx < m.col) m.face = -1;
    m.swingAt = now + (spot && !here ? 90 : 0);
  }

  // ---------- chain playback ----------

  play(res: ChainResult, m: MineState, beforeRev: boolean[], beforeEmpty: boolean[], target: number, usedTool: boolean, now: number, notice?: string) {
    if (!usedTool) {
      this.approach(target, beforeEmpty, now);
      now = this.miner.swingAt + 80;
    }
    const STEP = res.steps > 18 ? 38 : res.steps > 10 ? 48 : 62;
    const at = (step: number) => now + step * STEP;
    const breakAt = new Map<number, number>();
    let soundStep = -1;
    let burnSound = -1;
    let hitSound = -1;
    this.live = 0;

    if (res.freeHit) this.text(this.W / 2, SURF + 6, 'LUCKY!', '#7dff9b', 8);

    for (const e of res.events) {
      const t = at(e.step);
      switch (e.t) {
        case 'hit': {
          const k = m.cells[e.i].k;
          this.later(t, () => {
            this.squash.set(e.i, performance.now());
            this.burstAt(e.i, tileColor(k), 6, 0.8);
            this.shake = Math.max(this.shake, 1);
            if (hitSound !== e.step) {
              hitSound = e.step;
              sfx.hit();
            }
          });
          break;
        }
        case 'break':
          this.ghosts.set(e.i, { k: e.k, until: t });
          breakAt.set(e.i, t);
          this.later(t, () => {
            this.live++;
            this.onCombo(this.live);
            const ore = isOre(e.k);
            this.burstAt(e.i, tileColor(e.k), ore ? 12 : 8, ore ? 1.1 : 0.9);
            if (ore) this.burstAt(e.i, '#fff8d0', 5, 0.6, true);
            this.shake = Math.max(this.shake, 1.2);
            if (soundStep !== e.step) {
              soundStep = e.step;
              sfx.break(this.live);
            }
            if (e.k === 'stairs') {
              this.ring(e.i, 30, '#5aa9ff', 0.8);
              sfx.stairs();
            }
          });
          break;
        case 'burn':
          this.ghosts.set(e.i, { k: e.k, until: t });
          breakAt.set(e.i, t);
          this.later(t, () => {
            this.burstAt(e.i, '#3a3a3a', 10, 0.6, true);
            this.burstAt(e.i, '#ff7a1a', 6, 0.8);
            this.text(this.cx(e.i), this.cy(e.i), 'BURNT', '#ff9a5a', 6, 0.8);
            if (burnSound !== e.step) {
              burnSound = e.step;
              sfx.burn();
            }
          });
          break;
        case 'explode':
          this.later(t, () => {
            this.ring(e.i, T * (e.r + 0.7), '#ffb347', 0.45);
            this.ring(e.i, T * (e.r + 0.2), '#fff1c1', 0.25);
            this.burstAt(e.i, '#ff7a1a', 18, 1.6);
            this.burstAt(e.i, '#ffe08a', 10, 1.4, true);
            this.shake = Math.min(5, this.shake + 1.6 + e.r * 0.8);
            this.flash = 0.35;
            this.flashColor = '#ffcf8a';
            sfx.explode(e.r);
          });
          break;
        case 'gas':
          this.later(t, () => {
            this.ring(e.i, T * 1.3, '#a6e05a', 0.4);
            this.burstAt(e.i, '#b5e86a', 10, 0.7, true);
            sfx.gas();
          });
          break;
        case 'shard':
          this.later(t, () => {
            const x0 = (e.i % this.w) * T + T / 2;
            const y0 = SURF + Math.floor(e.i / this.w) * T + T / 2;
            const len = e.len * T;
            const bx = e.dx < 0 ? x0 - len : x0;
            const by = e.dy < 0 ? y0 - len : y0;
            this.beams.push({ x: e.dx ? bx : x0 - 1, y: e.dy ? by : y0 - 1, w: e.dx ? len : 2, h: e.dy ? len : 2, life: 0, max: 0.35 });
            sfx.shard();
          });
          break;
        case 'lava':
          this.later(t, () => this.ring(e.i, T * 1.5, '#ff5a1a', 0.5));
          break;
        case 'magnet':
          this.later(t, () => {
            this.ring(e.i, 3, '#ff5a6e', 0.5, T * (e.r + 0.5));
            this.text(this.cx(e.i), this.cy(e.i), 'MAGNET', '#ff7b8b', 6);
          });
          break;
        case 'energy':
          this.later(t, () => {
            this.text(this.cx(e.i), this.cy(e.i), `+${e.amt}⚡`, '#ffe14d', 8);
            this.burstAt(e.i, '#ffe14d', 10, 0.8, true);
            sfx.energy();
          });
          break;
        case 'chest':
          this.later(t, () => {
            this.text(this.cx(e.i), this.cy(e.i), e.text.toUpperCase(), '#ffd34d', 6, 1.6);
            this.burstAt(e.i, '#ffd34d', 16, 1, true);
            sfx.chest();
          });
          break;
        case 'mult':
          this.later(t, () => {
            this.text(this.cx(e.i), this.cy(e.i), '+1× MULT', '#e8a8ff', 8, 1.3);
            this.ring(e.i, T * 1.6, '#c77dff', 0.5);
            this.flash = 0.25;
            this.flashColor = '#c77dff';
            sfx.mult();
          });
          break;
        case 'relic':
          this.later(t, () => {
            const r = RELIC_MAP[e.relic];
            this.text(this.cx(e.i), this.cy(e.i) - 4, `${(r?.name ?? 'Relic').toUpperCase()}!`, '#fff0c2', 6, 2);
            this.ring(e.i, T * 2.2, '#fff0c2', 0.9);
            this.burstAt(e.i, '#fff0c2', 24, 1.2, true);
            sfx.relic();
          });
          break;
        case 'reveal':
          this.revealAt.set(e.i, t);
          this.later(t, () => sfx.tick());
          break;
        case 'collapse':
          // The tile is already rock in the state: show it as open ground until it falls in.
          this.ghosts.set(e.i, { k: 'empty', until: t });
          this.later(t, () => {
            this.squash.set(e.i, performance.now());
            this.burstAt(e.i, '#8a7a6a', 12, 0.9);
          });
          break;
        case 'quake':
          this.later(t, () => {
            this.shake = Math.min(6, this.shake + 3);
            this.text(this.W / 2, SURF + 14, 'CAVE-IN!', '#d9c3a5', 8, 1.2);
            sfx.explode(1);
          });
          break;
      }
    }

    const end = at(res.steps) + 40;
    for (let i = 0; i < m.cells.length; i++) {
      if (!beforeRev[i] && m.cells[i].rev && !this.revealAt.has(i)) this.revealAt.set(i, breakAt.get(i) ?? end - 40);
    }
    this.later(end, () => this.finale(res, notice));
    this.busyUntil = end + 30;
  }

  private finale(res: ChainResult, notice?: string) {
    const W = this.W;
    let y = SURF + this.h * T * 0.38;
    if (res.combo >= 3) {
      const size = res.combo >= 25 ? 16 : res.combo >= 12 ? 12 : 8;
      this.text(W / 2, y, `${res.combo} CHAIN`, comboColor(res.combo), size, 1.5, -6);
      y += size + 4;
      this.text(W / 2, y, `×${res.mult.toFixed(2)}`, '#ffffff', 8, 1.5, -6);
      y += 12;
      if (res.combo >= 12) {
        const word = res.combo >= 45 ? 'GODLIKE!!!' : res.combo >= 25 ? 'INSANE!!' : 'MEGA CHAIN!';
        this.text(W / 2, y - size * 2 - 16, word, comboColor(res.combo), 8, 1.6, -8);
        this.shake = Math.min(5, this.shake + 2);
        sfx.combo(res.combo);
      }
    }
    const entries = (Object.entries(res.cargo) as [Ore, number][]).sort((a, b) => ORES.indexOf(b[0]) - ORES.indexOf(a[0]));
    entries.forEach(([k, n], idx) => {
      this.text(W / 2, y + idx * 10, `+${n} ${ORE_INFO[k].name.toUpperCase()}`, k === 'coal' ? '#c8c4d0' : ORE_INFO[k].color, 6, 1.4, -8);
    });
    if (entries.length) sfx.coin(entries.length);
    if (notice) this.text(W / 2, SURF + 20, notice, '#7cc0ff', 8, 2.6, -2);
    setTimeout(() => {
      if (performance.now() >= this.busyUntil) this.onCombo(0);
    }, 1400);
  }

  // ---------- frame ----------

  frame(m: MineState, now: number, dt: number, preview: Preview) {
    if (this.timeline.length) {
      const due = this.timeline.filter((e) => e.at <= now);
      if (due.length) {
        this.timeline = this.timeline.filter((e) => e.at > now);
        for (const e of due) e.fn();
      }
    }
    this.update(dt);
    this.draw(m, now, preview);
  }

  private update(dt: number) {
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life += dt;
      t.pop = Math.min(1, t.pop + dt * 8);
      t.y += t.vy * dt;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const b of this.beams) b.life += dt;
    this.beams = this.beams.filter((b) => b.life < b.max);
    this.shake *= Math.pow(0.004, dt);
    if (this.shake < 0.15) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  private draw(m: MineState, now: number, preview: Preview) {
    const c = this.c;
    const W = this.W;
    const H = this.H;
    const biome = biomeFor(m.layer);
    c.save();
    c.clearRect(-8, -8, W + 16, H + 16);
    if (this.shake > 0) c.translate(Math.round((Math.random() - 0.5) * this.shake * 2), Math.round((Math.random() - 0.5) * this.shake * 2));
    c.fillStyle = shade(biome.bg, -0.4);
    c.fillRect(-8, -8, W + 16, H + 16);
    this.drawSurface(m, now, biome.bg);

    const busy = this.busy(now);
    const frame = Math.floor(now / 260) % 3;
    for (let i = 0; i < m.cells.length; i++) {
      const cell = m.cells[i];
      const x = (i % m.w) * T;
      const y = SURF + Math.floor(i / m.w) * T;
      const v = Math.floor(hash(i, 1) * 3);
      const rAt = this.revealAt.get(i);
      if (!cell.rev || (rAt !== undefined && now < rAt)) {
        c.drawImage(fogSprite(v), x, y);
        continue;
      }
      const ghost = this.ghosts.get(i);
      let k = cell.k;
      let ratio = cell.max > 0 ? cell.hp / cell.max : 1;
      if (ghost) {
        if (now < ghost.until) {
          k = ghost.k;
          ratio = 1;
        } else this.ghosts.delete(i);
      }
      if (k === 'empty') {
        c.drawImage(emptySprite(biome.bg, v), x, y);
        const above = i - m.w;
        if (above >= 0 && m.cells[above].k !== 'empty') {
          c.fillStyle = 'rgba(0,0,0,0.4)';
          c.fillRect(x, y, T, 2);
        }
      } else {
        const sprite = tileSprite(k, ANIMATED.has(k) ? frame : v);
        const sq = this.squash.get(i);
        if (sq !== undefined && now - sq < 140) {
          const s = 1 - 0.18 * Math.sin(((now - sq) / 140) * Math.PI);
          const d = (T * (1 - s)) / 2;
          c.drawImage(sprite, x + d, y + d, T * s, T * s);
        } else {
          if (sq !== undefined) this.squash.delete(i);
          c.drawImage(sprite, x, y);
        }
        if (ratio < 1) this.cracks(x, y, i, ratio);
        if (!busy && !preview.tool && canDig(m, i) && m.energy > 0) this.corners(x, y, T, 'rgba(255,240,200,0.45)', 2, 0);
      }
      if (rAt !== undefined) {
        const t = (now - rAt) / 260;
        if (t < 1) {
          c.globalAlpha = 1 - t;
          c.drawImage(fogSprite(v), x, y);
          c.globalAlpha = 1;
        } else this.revealAt.delete(i);
      }
    }

    if (m.water !== undefined && m.water >= 0) {
      const wy = SURF + m.water * T;
      const bob = Math.round(Math.sin(now / 500) * 1);
      c.fillStyle = 'rgba(40,110,220,0.22)';
      c.fillRect(0, wy, this.W, this.H - wy);
      c.fillStyle = 'rgba(150,210,255,0.55)';
      c.fillRect(0, wy + bob, this.W, 2);
    }

    this.drawMiner(now);
    this.drawHover(m, preview, busy, now);

    for (const r of this.rings) {
      const t = r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3));
      c.fillStyle = r.color;
      c.globalAlpha = 1 - t;
      const n = Math.max(12, Math.floor(rad * 1.6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        c.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad), 2, 2);
      }
    }
    for (const b of this.beams) {
      const t = b.life / b.max;
      c.globalAlpha = 1 - t;
      c.fillStyle = '#8ff3ff';
      const grow = b.w > b.h ? [0, -1, 0, 2] : [-1, 0, 2, 0];
      c.fillRect(b.x + grow[0], b.y + grow[1], b.w + grow[2], b.h + grow[3]);
      c.fillStyle = '#ffffff';
      c.fillRect(b.x, b.y, b.w, b.h);
    }
    for (const p of this.particles) {
      const t = p.life / p.max;
      c.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    c.globalAlpha = 1;
    for (const t of this.texts) {
      const k = t.life / t.max;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const pop = t.pop < 1 ? 1 + 0.5 * (1 - t.pop) : 1;
      this.pixelText(t.text, t.x, Math.round(t.y), t.color, Math.round(t.size * pop));
    }
    c.globalAlpha = 1;
    if (this.flash > 0) {
      c.globalAlpha = this.flash * 0.5;
      c.fillStyle = this.flashColor;
      c.fillRect(-8, -8, W + 16, H + 16);
      c.globalAlpha = 1;
    }
    c.restore();
  }

  pixelText(text: string, x: number, y: number, color: string, size: number) {
    const c = this.c;
    c.font = `${size}px ${FONT}`;
    let s = size;
    while (c.measureText(text).width > this.W - 4 && s > 4) {
      s -= 1;
      c.font = `${s}px ${FONT}`;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const w = c.measureText(text).width;
    x = Math.max(w / 2 + 2, Math.min(this.W - w / 2 - 2, x));
    c.fillStyle = '#140c10';
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
    ])
      c.fillText(text, x + dx, y + dy);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  private cracks(x: number, y: number, i: number, ratio: number) {
    const c = this.c;
    c.fillStyle = 'rgba(10,6,12,0.85)';
    const n = ratio < 0.34 ? 3 : ratio < 0.67 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      let cx = x + 5 + Math.floor(hash(i, k + 60) * 6);
      let cy = y + 4 + Math.floor(hash(i, k + 70) * 6);
      const dx = hash(i, k + 80) < 0.5 ? 1 : -1;
      for (let s = 0; s < 6; s++) {
        c.fillRect(cx, cy, 1, 1);
        if (s % 2) cx += dx;
        else cy += 1;
      }
    }
  }

  /** Pixel corner brackets, the classic selection cursor. */
  private corners(x: number, y: number, size: number, color: string, len: number, off: number) {
    const c = this.c;
    c.fillStyle = color;
    const x0 = x - off;
    const y0 = y - off;
    const x1 = x + size + off - 1;
    const y1 = y + size + off - 1;
    c.fillRect(x0, y0, len, 1);
    c.fillRect(x0, y0, 1, len);
    c.fillRect(x1 - len + 1, y0, len, 1);
    c.fillRect(x1, y0, 1, len);
    c.fillRect(x0, y1, len, 1);
    c.fillRect(x0, y1 - len + 1, 1, len);
    c.fillRect(x1 - len + 1, y1, len, 1);
    c.fillRect(x1, y1 - len + 1, 1, len);
  }

  private drawSurface(m: MineState, now: number, bg: string) {
    const c = this.c;
    const W = this.W;
    if (m.layer === 1) {
      const bands = ['#3d7be0', '#5a98f0', '#7cb6ff', '#9ccaff'];
      bands.forEach((col, k) => {
        c.fillStyle = col;
        c.fillRect(0, k * 5, W, 6);
      });
      c.fillStyle = '#ffffff';
      const drift = (now / 400) % (W + 40);
      for (const [ox, oy] of [
        [10, 5],
        [90, 9],
      ]) {
        const x = ((ox + drift) % (W + 40)) - 20;
        c.fillRect(x, oy, 14, 3);
        c.fillRect(x + 3, oy - 2, 7, 2);
      }
      c.fillStyle = '#2f8a3c';
      c.fillRect(0, SURF - 4, W, 4);
      c.fillStyle = '#5fdc6a';
      c.fillRect(0, SURF - 4, W, 1);
      for (let x = 0; x < W; x += 5) c.fillRect(x + (x % 3), SURF - 5, 1, 1);
    } else {
      c.fillStyle = shade(bg, -0.15);
      c.fillRect(0, 0, W, SURF);
      c.fillStyle = shade(bg, 0.08);
      for (let x = 0; x < W; x += 7) c.fillRect(x, 0, 3, 2 + ((x * 7) % 5));
      c.fillStyle = '#6a4424';
      c.fillRect(0, SURF - 3, W, 3);
      c.fillStyle = '#8a5a30';
      c.fillRect(0, SURF - 3, W, 1);
      for (let x = 12; x < W; x += 48) {
        c.fillStyle = '#5a3a1c';
        c.fillRect(x, 0, 3, SURF - 3);
        const glow = 0.5 + 0.5 * Math.sin(now / 300 + x);
        c.fillStyle = `rgba(255,210,90,${0.15 + glow * 0.15})`;
        c.fillRect(x - 5, 6, 13, 9);
        c.fillStyle = '#ffd34d';
        c.fillRect(x, 8, 3, 3);
      }
    }
    const label = `L${m.layer} ${biomeFor(m.layer).name.toUpperCase()}`;
    c.font = `6px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = 'rgba(20,12,16,0.75)';
    c.fillRect(0, 0, Math.ceil(c.measureText(label).width) + 5, 10);
    c.fillStyle = '#140c10';
    c.fillText(label, 3, 3);
    c.fillStyle = '#fff4e0';
    c.fillText(label, 2, 2);
  }

  private drawMiner(now: number) {
    const c = this.c;
    const m = this.miner;
    const t = Math.min(1, (now - m.moveAt) / 110);
    const col = m.fromCol + (m.col - m.fromCol) * t;
    const row = m.fromRow + (m.row - m.fromRow) * t;
    const x = Math.round(col * T);
    const y = Math.round(SURF + row * T - Math.sin(t * Math.PI) * 5);
    const since = now - m.swingAt;
    const frame = since < 0 ? 0 : since < 80 ? 1 : since < 240 ? 2 : 0;
    const sprite = minerSprite(frame as 0 | 1 | 2);
    c.save();
    if (m.face < 0) {
      c.translate(x + T / 2, 0);
      c.scale(-1, 1);
      c.translate(-(x + T / 2), 0);
    }
    c.drawImage(sprite, x - 4, y - 4, MINER_W, MINER_H);
    c.restore();
  }

  private drawHover(m: MineState, preview: Preview, busy: boolean, now: number) {
    const c = this.c;
    const i = this.hover;
    if (i < 0 || i >= m.cells.length || busy) return;
    const hx = i % m.w;
    const hy = Math.floor(i / m.w);
    const bob = Math.floor(now / 250) % 2;
    const area = (x0: number, y0: number, x1: number, y1: number, fill: string, stroke: string) => {
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(m.w - 1, x1);
      y1 = Math.min(m.h - 1, y1);
      c.fillStyle = fill;
      for (let y = y0 * T; y < (y1 + 1) * T; y += 2) {
        for (let x = x0 * T + ((y / 2) % 2) * 1; x < (x1 + 1) * T; x += 2) c.fillRect(x, SURF + y, 1, 1);
      }
      this.corners(x0 * T, SURF + y0 * T, (x1 - x0 + 1) * T, stroke, 4, bob);
      if (y1 > y0 || x1 > x0) {
        // keep it a rectangle for rows
        const w = (x1 - x0 + 1) * T;
        const h = (y1 - y0 + 1) * T;
        if (w !== h) {
          c.fillStyle = stroke;
          c.fillRect(x0 * T, SURF + y0 * T, w, 1);
          c.fillRect(x0 * T, SURF + y0 * T + h - 1, w, 1);
        }
      }
    };
    if (preview.tool === 'dynamite') {
      const r = preview.blast;
      area(hx - r, hy - r, hx + r, hy + r, 'rgba(255,90,40,0.5)', '#ff7a3d');
    } else if (preview.tool === 'drill') {
      area(0, hy, m.w - 1, hy, 'rgba(255,220,90,0.45)', '#ffd34d');
    } else if (preview.tool === 'scanner') {
      area(hx - SCAN_R, hy - SCAN_R, hx + SCAN_R, hy + SCAN_R, 'rgba(90,170,255,0.45)', '#5aa9ff');
    } else {
      const ok = canDig(m, i) && m.energy > 0;
      this.corners(hx * T, SURF + hy * T, T, ok ? '#ffffff' : '#ff5a5a', ok ? 4 : 3, ok ? bob : 0);
    }
  }
}
