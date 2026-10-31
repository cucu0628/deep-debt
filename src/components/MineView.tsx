import { useEffect, useRef, useState } from 'react';
import { sfx } from '../fx/audio';
import { MineRenderer, comboColor } from '../fx/renderer';
import { bestCell } from '../game/autodig';
import { biomeFor } from '../game/data/biomes';
import { MUTATOR_MAP } from '../game/data/mutators';
import { RELIC_MAP } from '../game/data/relics';
import { ORES, ORE_INFO, ROCKS, TILE_INFO, isOre, tileName, type Rock } from '../game/data/tiles';
import { TOOLS, TOOL_IDS, type ToolId } from '../game/data/upgrades';
import { canDig, hitCost } from '../game/mine';
import { DRINK_ENERGY, applyTool, drinkEnergy, mineHit, surface } from '../game/run';
import { derive } from '../game/stats';
import { toast, useGame, useUi } from '../store';
import { Btn, Icon, TileIcon } from './common';
import { RewardButton } from './RewardButton';
import { AD_ENERGY, adEnergy } from '../game/rewards';

function MineCanvas({ onHover, auto, stopAuto }: { onHover: (i: number) => void; auto: boolean; stopAuto: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rend = useRef<MineRenderer | null>(null);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const stopRef = useRef(stopAuto);
  stopRef.current = stopAuto;

  useEffect(() => {
    const r = new MineRenderer(canvas.current!);
    rend.current = r;
    r.onCombo = (n) => useUi.setState({ liveCombo: n });
    let key = '';
    const measure = () => {
      const el = wrap.current;
      const m = useGame.getState().game.run.mine;
      if (!el || !m) return;
      const aw = el.clientWidth;
      const ah = window.innerHeight - 96;
      const k = `${aw}:${ah}:${m.w}:${window.devicePixelRatio}`;
      if (k !== key) {
        key = k;
        r.resize(aw, ah, m.w, m.h);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current!);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = useGame.getState().game;
      const m = g.run.mine;
      if (m) {
        measure();
        const tool = useUi.getState().tool;
        r.frame(m, now, dt, { tool, blast: tool === 'dynamite' ? derive(g).blastRadius + 1 : 0 });
        if (autoRef.current && !r.busy(now)) {
          const i = m.energy > 0 ? bestCell(g) : -1;
          if (i < 0 || !digRef.current(i, null)) stopRef.current();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // the pixel font may arrive after the first frames
    document.fonts?.ready.then(() => (key = ''));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const cellFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return rend.current!.cellAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  /** Hits (or uses a tool on) cell `i` and plays the result. Returns false if nothing happened. */
  const dig = (i: number, tool: ToolId | null): boolean => {
    const r = rend.current!;
    const now = performance.now();
    const { act, game } = useGame.getState();
    if (!game.run.mine) return false;
    const cells = game.run.mine.cells;
    const beforeRev = cells.map((c) => c.rev);
    const beforeEmpty = cells.map((c) => c.k === 'empty');
    const prevMax = game.run.maxLayer;
    const res = tool ? act((g) => applyTool(g, tool, i)) : act((g) => mineHit(g, i));
    if (!res) {
      sfx.error();
      if (!tool && game.run.mine.energy <= 0) toast('Out of energy. Return to the surface!', 'bad');
      return false;
    }
    const g = useGame.getState().game;
    if (tool && g.run.tools[tool] <= 0) useUi.setState({ tool: null });
    let notice: string | undefined;
    if (res.newBottom) notice = g.run.maxLayer > prevMax ? `LAYER ${g.run.maxLayer} OPEN!` : 'NEED A PERMIT!';
    r.play(res, g.run.mine!, beforeRev, beforeEmpty, i, !!tool, now, notice);
    for (const id of res.relics) {
      const rel = RELIC_MAP[id];
      const dupe = (g.meta.relics[id] ?? 0) > 1;
      setTimeout(() => toast(`${rel.icon} ${rel.name}${dupe ? ' (duplicate, sold)' : ' added to your collection!'}`, 'gold'), 600);
    }
    return true;
  };
  const digRef = useRef(dig);
  digRef.current = dig;

  const click = (e: React.MouseEvent) => {
    if (rend.current!.busy(performance.now())) return;
    const i = cellFromEvent(e);
    if (i < 0) return;
    stopRef.current();
    dig(i, useUi.getState().tool);
  };

  return (
    <div className="canvas-wrap" ref={wrap}>
      <div className="mine-frame">
        <canvas
          ref={canvas}
          onClick={click}
          onContextMenu={(e) => {
            e.preventDefault();
            useUi.setState({ tool: null });
          }}
          onPointerMove={(e) => {
            const i = cellFromEvent(e);
            rend.current!.hover = i;
            onHover(i);
          }}
          onPointerLeave={() => {
            rend.current!.hover = -1;
            onHover(-1);
          }}
        />
      </div>
    </div>
  );
}

export function MineView() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const tool = useUi((s) => s.tool);
  const live = useUi((s) => s.liveCombo);
  const [hover, setHover] = useState(-1);
  const [auto, setAuto] = useState(false);
  const canAuto = (g.meta.legacy.foreman ?? 0) > 0;
  const m = g.run.mine!;
  const stats = derive(g);
  const biome = biomeFor(m.layer);
  const maxE = stats.maxEnergy + stats.digBonusEnergy;
  const hc = hover >= 0 ? m.cells[hover] : null;

  const pickTool = (id: ToolId) => {
    const run = useGame.getState().game.run;
    if (run.tools[id] <= 0) return sfx.error();
    if (id === 'drink') {
      if (act((x) => drinkEnergy(x))) {
        sfx.energy();
        toast(`+${DRINK_ENERGY} energy`, 'good');
      }
      return;
    }
    sfx.click();
    useUi.setState((s) => ({ tool: s.tool === id ? null : id }));
  };

  const goUp = () => {
    setAuto(false);
    act((x) => surface(x));
    useUi.setState({ showSummary: true, tool: null, liveCombo: 0 });
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useUi.setState({ tool: null });
      const n = Number(e.key);
      if (n >= 1 && n <= TOOL_IDS.length) pickTool(TOOL_IDS[n - 1]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const haul = ORES.filter((o) => m.haul[o]);

  return (
    <div className="mine-view">
      <div className="mine-main">
        <MineCanvas onHover={setHover} auto={auto} stopAuto={() => setAuto(false)} />
        {m.energy <= 0 && (
          <div className="out-of-energy px-panel">
            <Icon e="😮‍💨" size={32} />
            <div>OUT OF ENERGY</div>
            <RewardButton
              placement="energy"
              label={`AD: +${AD_ENERGY} ENERGY`}
              onReward={() => {
                act((x) => adEnergy(x));
                sfx.energy();
                toast(`+${AD_ENERGY} energy`, 'good');
              }}
            />
            <Btn kind="gold" onClick={goUp}>
              ▲ SURFACE
            </Btn>
          </div>
        )}
      </div>
      <aside className="mine-side">
        <div className="px-panel">
          <div className="layer-title" style={{ background: biome.bg }}>
            <small>{biome.name}</small>
            <b>LAYER {m.layer}</b>
          </div>
          <div className="energy-label">
            <span>ENERGY</span>
            <b className={m.energy <= 2 ? 'low' : ''}>
              {m.energy}/{maxE}
            </b>
          </div>
          <div className="energy-pips">
            {Array.from({ length: Math.max(maxE, m.energy) }, (_, k) => (
              <span key={k} className={k < m.energy ? 'on' : ''} />
            ))}
          </div>
          <div className="dim small">
            ⛏ POWER {stats.pickPower} · 🧨 TNT {stats.blastPower} · 1 hit = {m.water !== undefined && m.water >= 0 ? '1-2' : '1'} energy
            {stats.pierce > 0 ? ' · 🗡️ PIERCE' : ''}
          </div>
          {canAuto && (
            <Btn kind={auto ? 'gold' : 'blue'} className={auto ? 'auto-on' : ''} disabled={m.energy <= 0} onClick={() => setAuto(!auto)}>
              {auto ? '⏸ STOP AUTO-DIG' : '🤖 AUTO-DIG'}
            </Btn>
          )}
        </div>

        {!!m.mods?.length && (
          <div className="px-panel">
            <h4>CLAIM · +{Math.round((m.bonus ?? 0) * 100)}% LOOT</h4>
            <div className="mod-list">
              {m.mods.map((id) => (
                <div key={id} className="mod-line" data-tip={MUTATOR_MAP[id].desc}>
                  <Icon e={MUTATOR_MAP[id].icon} size={20} />
                  <b>{MUTATOR_MAP[id].name}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`px-panel combo ${live > 0 ? 'active' : ''}`}>
          <div className="combo-num" style={{ color: comboColor(live) }} key={live}>
            {live > 0 ? live : m.bestCombo}
          </div>
          <div className="dim small">{live > 0 ? 'CHAIN!' : 'BEST CHAIN TODAY'}</div>
        </div>

        <div className="px-panel">
          <h4>TOOLS</h4>
          <div className="hotbar">
            {TOOL_IDS.map((id, n) => (
              <button
                key={id}
                className={`slot big ${tool === id ? 'sel' : ''}`}
                disabled={g.run.tools[id] <= 0}
                data-tip={`${TOOLS[id].name}: ${TOOLS[id].desc}`}
                onClick={() => pickTool(id)}
              >
                <Icon e={TOOLS[id].icon} size={32} />
                <span className="slot-n">{g.run.tools[id]}</span>
                <span className="slot-key">{n + 1}</span>
              </button>
            ))}
          </div>
          <div className="dim small">{tool ? `${TOOLS[tool].name.toUpperCase()}: click a tile · right-click cancels` : 'Keys 1-4 · buy more in the Tool Shop'}</div>
        </div>

        <div className="px-panel">
          <h4>TODAY'S HAUL</h4>
          {haul.length === 0 && !m.cashFound && <div className="dim small">Nothing yet. Dig in!</div>}
          <div className="haul">
            {haul.map((o) => (
              <div key={o} className="haul-row">
                <TileIcon k={o} size={24} />
                {ORE_INFO[o].name}
                <b>×{m.haul[o]}</b>
              </div>
            ))}
            {m.cashFound > 0 && (
              <div className="haul-row">
                <Icon e="💰" size={24} />
                Cash
                <b>${m.cashFound}</b>
              </div>
            )}
          </div>
        </div>

        <div className="px-panel tile-info">
          {hc && hc.rev && hc.k !== 'empty' ? (
            <div className="tile-info-row">
              <TileIcon k={hc.k} size={48} />
              <div>
                <b>{tileName(hc.k)}</b>
                <div className="dim small">{isOre(hc.k) ? `~$${ORE_INFO[hc.k].value} each. Mining one collects the whole vein!` : TILE_INFO[hc.k].desc}</div>
                <div className="small">
                  {hc.k === 'bedrock' ? 'UNBREAKABLE' : `HP ${hc.hp}/${hc.max} · ${Math.ceil(hc.hp / stats.pickPower)} HIT${Math.ceil(hc.hp / stats.pickPower) === 1 ? '' : 'S'}`}
                  {hitCost(m, hover) > 1 ? ' · 🌊 2 ENERGY/HIT' : ''}
                  {canDig(m, hover) ? '' : ' · out of reach'}
                  {(isOre(hc.k) || ROCKS.includes(hc.k as Rock)) && hc.k !== 'bedrock' && (
                    <span className={hc.hp > stats.blastPower ? 'red' : 'green'}>{hc.hp > stats.blastPower ? ' · BLAST-PROOF' : ' · TNT BREAKS IT'}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="dim small">Point at a tile to inspect it. You can only dig tiles that touch open ground.</span>
          )}
        </div>

        <Btn kind={m.energy > 0 ? 'default' : 'gold'} className="big" onClick={goUp}>
          ▲ {m.energy > 0 ? 'SURFACE EARLY' : 'SURFACE'}
        </Btn>
      </aside>
    </div>
  );
}
