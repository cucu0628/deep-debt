import { useEffect, useRef, useState } from 'react';
import { sfx } from '../fx/audio';
import { TownScene, type BuildingId } from '../fx/town';
import { BIOMES, biomeFor } from '../game/data/biomes';
import { MUTATOR_MAP, mutatorReward } from '../game/data/mutators';
import { ORES, ORE_INFO, type Ore } from '../game/data/tiles';
import { TOOLS, TOOL_IDS } from '../game/data/upgrades';
import {
  buyTool,
  debtRemaining,
  descend,
  endDay,
  foreclose,
  inventoryValue,
  payDebt,
  sell,
  todaysClaims,
  toolPrice,
  unitPrice,
} from '../game/run';
import { derive } from '../game/stats';
import { fmt, money, unit } from '../format';
import { toast, useGame, useUi } from '../store';
import { Bar, Btn, Icon, Modal, TileIcon } from './common';
import { SkillTree } from './SkillTree';
import { RewardButton } from './RewardButton';
import { adReroll } from '../game/rewards';
import { Saloon } from './saloon/Saloon';

function TownCanvas({ onPick }: { onPick: (id: BuildingId) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<TownScene | null>(null);
  const day = useGame((s) => s.game.run.day);

  useEffect(() => {
    const sc = new TownScene(canvas.current!);
    scene.current = sc;
    let key = '';
    const measure = () => {
      const el = wrap.current;
      if (!el) return;
      const aw = el.clientWidth;
      const ah = window.innerHeight - 190;
      const k = `${aw}:${ah}:${window.devicePixelRatio}`;
      if (k !== key) {
        key = k;
        sc.resize(aw, ah);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current!);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      measure();
      const run = useGame.getState().game.run;
      sc.frame(now, dt, {
        evening: run.minedToday,
        urgent: run.debtDue - run.day <= 1 && debtRemaining(run) > 0,
        canDig: !run.minedToday,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const m = useGame.getState().game.run.morning;
    if (m && scene.current) {
      if (m.minerOre) scene.current.floatText('mine', `+${fmt(m.minerOre)} ORE`, '#ffd34d');
      if (m.interest) scene.current.floatText('company', `+$${fmt(m.interest)}`, '#5fdc6a');
    }
  }, [day]);

  const pos = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return scene.current!.hit(e.clientX - r.left, e.clientY - r.top);
  };

  return (
    <div className="town-wrap" ref={wrap}>
      <div className="scene-frame">
        <canvas
          ref={canvas}
          className="town-canvas"
          onPointerMove={(e) => {
            const id = pos(e);
            if (id !== scene.current!.hover && id) sfx.tick();
            scene.current!.hover = id;
            canvas.current!.style.cursor = id ? 'pointer' : 'default';
          }}
          onPointerLeave={() => (scene.current!.hover = null)}
          onClick={(e) => {
            const id = pos(e);
            if (!id) return;
            sfx.click();
            scene.current!.walkTo(id);
            onPick(id);
          }}
        />
      </div>
    </div>
  );
}

// ---------- building windows ----------

function MineWindow({ close }: { close: () => void }) {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  const stats = derive(g);
  const [layer, setLayer] = useState(run.maxLayer);
  const [claim, setClaim] = useState(0);
  const biome = biomeFor(layer);
  const next = run.maxLayer + 1;
  // Old saves have no claims yet; rolling them is deterministic, so a local copy is fine for display.
  const claims = run.claims?.length ? run.claims : todaysClaims(structuredClone(g));

  if (run.minedToday) {
    return (
      <div className="center-col">
        <Icon e="😴" size={64} />
        <p>Your miner is too tired to dig again today.</p>
        <p className="dim">Sleep to start a new day.</p>
        <Btn onClick={close}>OK</Btn>
      </div>
    );
  }
  return (
    <div className="center-col">
      <div className="layer-pick" style={{ background: biome.bg }}>
        <button className="btn" disabled={layer <= 1} onClick={() => setLayer(layer - 1)}>
          ◀
        </button>
        <div className="layer-mid">
          <small>{biome.name.toUpperCase()}</small>
          <b>LAYER {layer}</b>
          <div className="ore-dots">
            {(Object.keys(biome.ores) as Ore[]).map((o) => (
              <span key={o} data-tip={ORE_INFO[o].name}>
                <TileIcon k={o} size={32} />
              </span>
            ))}
          </div>
        </div>
        <button className="btn" disabled={layer >= run.maxLayer} onClick={() => setLayer(layer + 1)}>
          ▶
        </button>
      </div>
      <div className="dim small">
        🔒 Layer {next}: {next > stats.permitLayer ? 'needs a Mining Permit from The Company' : 'break the Stairs on the bottom of Layer ' + run.maxLayer}
      </div>
      {claims.length > 1 && (
        <div className="claims">
          <div className="dim small">Today's claims. Rougher ground pays more.</div>
          {claims.map((c, n) => {
            const reward = mutatorReward(c.mods);
            return (
              <button
                key={n}
                className={`claim ${claim === n ? 'sel' : ''}`}
                onClick={() => {
                  sfx.click();
                  setClaim(n);
                }}
              >
                <div className="claim-head">
                  <b>CLAIM {String.fromCharCode(65 + n)}</b>
                  <span className={reward > 0 ? 'gold' : 'dim'}>{reward > 0 ? `+${Math.round(reward * 100)}% LOOT` : 'PLAIN'}</span>
                </div>
                {c.mods.length === 0 && <div className="dim small">Nothing unusual. A normal dig.</div>}
                {c.mods.map((id) => (
                  <div key={id} className="mod-line">
                    <Icon e={MUTATOR_MAP[id].icon} size={20} />
                    <span>
                      <b>{MUTATOR_MAP[id].name}</b> <span className="dim">{MUTATOR_MAP[id].desc}</span>
                    </span>
                  </div>
                ))}
              </button>
            );
          })}
          <RewardButton
            placement="reroll"
            label="WATCH AN AD: NEW CLAIMS"
            onReward={() => {
              act((x) => adReroll(x));
              setClaim(0);
              toast('Fresh claims!', 'good');
            }}
          />
        </div>
      )}
      <Btn
        kind="gold"
        className="big"
        onClick={() => {
          if (act((x) => descend(x, layer, claim))) {
            sfx.stairs();
            close();
          }
        }}
      >
        ⛏ DESCEND!
      </Btn>
    </div>
  );
}

function CompanyWindow() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  const stats = derive(g);
  const rem = debtRemaining(run);
  const daysLeft = run.debtDue - run.day;
  const [confirm, setConfirm] = useState(false);
  const nextBiome = BIOMES.find((b) => b.fromLayer > stats.permitLayer);
  const pay = (amt: number) => {
    const before = run.debtIndex;
    const paid = act((x) => payDebt(x, amt));
    if (paid <= 0) return sfx.error();
    sfx.pay();
    if (useGame.getState().game.run.debtIndex > before) toast('Installment paid in full!', 'gold');
  };
  return (
    <div className="company">
      <div className="banker">
        <Icon e="🎩" size={56} />
        <div className="speech">
          {rem <= 0
            ? 'A pleasure doing business.'
            : daysLeft <= 0
              ? `Pay up TONIGHT, or we take everything.`
              : `Installment #${run.debtIndex + 1}. ${money(rem)} by Day ${run.debtDue}. Don't be late.`}
        </div>
      </div>
      <div className="company-row">
        <span>INSTALLMENT #{run.debtIndex + 1}</span>
        <b>{money(run.debtAmount)}</b>
      </div>
      <Bar value={run.debtPaid} max={run.debtAmount} color="#ffcd3c" />
      <div className="company-row small">
        <span>
          PAID {money(run.debtPaid)} · LEFT <b className="red">{money(rem)}</b>
        </span>
        <span className={daysLeft <= 1 ? 'red blink' : ''}>{daysLeft <= 0 ? 'DUE TONIGHT' : `DUE DAY ${run.debtDue} (${daysLeft}d)`}</span>
      </div>
      <div className="row gap">
        <Btn kind="gold" className="grow" disabled={run.cash <= 0} onClick={() => pay(rem)}>
          PAY {money(Math.min(rem, run.cash))}
        </Btn>
        <Btn disabled={run.cash <= 1} onClick={() => pay(Math.floor(run.cash / 2))}>
          PAY HALF
        </Btn>
      </div>
      <div className="reward-box small">
        <Icon e="🎁" size={24} />
        <span>
          Pay in full: choose an <b>artifact</b> + a <b>Mining Permit</b>
          {nextBiome ? (
            <>
              {' '}
              for <b>{nextBiome.name}</b>
            </>
          ) : null}
          .
        </span>
      </div>
      <div className="dim small">
        Permit: down to {isFinite(stats.permitLayer) ? `Layer ${stats.permitLayer}` : 'any depth'} · Next installment: {money(run.debtAmount * (stats.debtGrowth + 0.3 * run.debtIndex))}
      </div>
      <button
        className="link danger"
        onClick={() => {
          if (!confirm) return setConfirm(true);
          act((x) => foreclose(x));
        }}
      >
        {confirm ? 'Click again: give up this run and rebirth now' : 'Declare bankruptcy…'}
      </button>
    </div>
  );
}

function Market() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  const total = inventoryValue(g);
  const doSell = (o?: Ore) => {
    const got = act((x) => sell(x, o));
    if (got > 0) {
      sfx.coin(3);
      toast(`Sold for ${money(got)}`, 'good');
    }
  };
  return (
    <div className="market">
      <div className="row between">
        <div className="dim small">Prices change every day. Wait for a BOOM, or sell now.</div>
        <Btn kind="gold" disabled={total <= 0} onClick={() => doSell()}>
          SELL ALL · {money(total)}
        </Btn>
      </div>
      <div className="market-list">
        {ORES.map((o) => {
          const n = run.inventory[o] ?? 0;
          const p = unitPrice(g, o);
          const ch = run.prices[o] / run.prevPrices[o] - 1;
          const boom = run.prices[o] >= 1.6;
          return (
            <div key={o} className={`market-row ${n ? '' : 'faded'} ${boom ? 'boom' : ''}`}>
              <TileIcon k={o} size={32} />
              <div className="m-name">
                <b>{ORE_INFO[o].name}</b>
                <span className="dim small">×{fmt(n)} owned</span>
              </div>
              <div className="m-price">
                ${unit(p)}
                <span className={ch > 0.005 ? 'green' : ch < -0.005 ? 'red' : 'dim'}>
                  {ch > 0.005 ? '▲' : ch < -0.005 ? '▼' : '•'}
                  {Math.abs(ch * 100).toFixed(0)}%
                </span>
                {boom && <span className="tag">BOOM</span>}
              </div>
              <Btn className="sm" disabled={!n} onClick={() => doSell(o)}>
                {money(Math.floor(n * p))}
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Shop() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  return (
    <div className="shop">
      <h4>SKILL TREE · THIS RUN</h4>
      <SkillTree />
      <h4>TOOLS · SINGLE USE</h4>
      <div className="cards">
        {TOOL_IDS.map((id) => {
          const t = TOOLS[id];
          const price = toolPrice(g, id);
          return (
            <div key={id} className="card">
              <div className="card-top">
                <span className="slot">
                  <Icon e={t.icon} size={32} />
                  <span className="slot-n">{run.tools[id]}</span>
                </span>
                <b>{t.name}</b>
              </div>
              <div className="dim small">{t.desc}</div>
              <Btn
                kind="gold"
                disabled={run.cash < price}
                onClick={() => {
                  if (act((x) => buyTool(x, id))) sfx.buy();
                }}
              >
                {money(price)}
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TITLES: Record<BuildingId, [string, string]> = {
  mine: ['⛏️', 'THE MINE'],
  market: ['⚖️', 'MARKET'],
  shop: ['🛒', 'TOOL SHOP'],
  saloon: ['🎰', 'SALOON'],
  company: ['🏦', 'THE COMPANY'],
};

function ActionBar({ openMine }: { openMine: () => void }) {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  const [confirm, setConfirm] = useState(false);
  const dueNow = run.day >= run.debtDue && debtRemaining(run) > 0;
  const inv = inventoryValue(g);
  useEffect(() => setConfirm(false), [run.day, run.minedToday]);

  const sleep = () => {
    if (dueNow && !confirm) {
      setConfirm(true);
      sfx.error();
      return;
    }
    setConfirm(false);
    if (act((x) => endDay(x))) {
      sfx.tick();
      const m = useGame.getState().game.run.morning;
      if (m?.minerOre) toast(`Your miners hauled ${fmt(m.minerOre)} ore (~${money(m.miners)}). Sell it at the Market!`, 'good');
      if (m?.interest) toast(`Interest: +${money(m.interest)}`, 'good');
    }
  };

  return (
    <div className="action-bar px-panel">
      <div className="ab-status">
        <Icon e={run.minedToday ? '🌙' : '☀️'} size={32} />
        <div>
          <b>
            DAY {run.day} · {run.minedToday ? 'EVENING' : 'MORNING'}
          </b>
          <div className="dim small">
            {run.minedToday
              ? inv > 0
                ? `You have ${money(inv)} of ore. Sell it at the Market!`
                : 'Shop, gamble or pay the Company. Then sleep.'
              : 'Click the MINE to go digging. Visit the shops first if you like.'}
          </div>
        </div>
      </div>
      {dueNow && (
        <div className="ab-warn blink">
          <Icon e="💀" size={24} /> {money(debtRemaining(run))} DUE TONIGHT!
        </div>
      )}
      {run.minedToday ? (
        <Btn kind={dueNow ? 'danger' : 'blue'} className="ab-btn" disabled={!!run.pendingChoices} onClick={sleep}>
          {dueNow ? (confirm ? 'SURE? YOU LOSE IT ALL' : '☠ SLEEP & FORECLOSE') : '🌙 SLEEP'}
        </Btn>
      ) : (
        <Btn kind="gold" className="ab-btn" disabled={!!run.pendingChoices} onClick={openMine}>
          ⛏ GO DIG!
        </Btn>
      )}
    </div>
  );
}

export function TownView() {
  const [open, setOpen] = useState<BuildingId | null>(null);
  const close = () => {
    setOpen(null);
    useUi.setState({ heldCash: null });
  };
  return (
    <div className="town">
      <TownCanvas onPick={setOpen} />
      <ActionBar openMine={() => setOpen('mine')} />
      {open && (
        <Modal
          onClose={close}
          wide={open !== 'mine' && open !== 'company'}
          title={
            <>
              <Icon e={TITLES[open][0]} size={20} /> {TITLES[open][1]}
            </>
          }
        >
          {open === 'mine' && <MineWindow close={close} />}
          {open === 'market' && <Market />}
          {open === 'shop' && <Shop />}
          {open === 'saloon' && <Saloon />}
          {open === 'company' && <CompanyWindow />}
        </Modal>
      )}
    </div>
  );
}
