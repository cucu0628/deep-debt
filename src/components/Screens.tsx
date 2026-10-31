import { useEffect, useState } from 'react';
import { sfx } from '../fx/audio';
import { ARTIFACT_MAP } from '../game/data/artifacts';
import { BIOMES, biomeFor } from '../game/data/biomes';
import { CLAUSES, clauseBonus } from '../game/data/clauses';
import { LEGACY } from '../game/data/legacy';
import { RELIC_MAP, RELIC_SETS, completedSets } from '../game/data/relics';
import { ORES, ORE_INFO } from '../game/data/tiles';
import { baseShards, buyLegacy, calcShards, legacyPrice, pickArtifact, rebirth, startRun, toggleClause, unitPrice } from '../game/run';
import { derive } from '../game/stats';
import { fmt, money } from '../format';
import { toast, useGame, useUi } from '../store';
import { Btn, Icon, Modal, TileIcon } from './common';
import { RewardButton } from './RewardButton';
import { AD_SHARDS, adHaul, adShards } from '../game/rewards';

export function ArtifactPick() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const choices = g.run.pendingChoices;
  useEffect(() => {
    if (choices) sfx.relic();
  }, [choices]);
  if (!choices || g.run.phase !== 'town') return null;
  const permit = derive(g).permitLayer;
  const biome = isFinite(permit) ? biomeFor(permit) : BIOMES[BIOMES.length - 1];
  return (
    <Modal wide className="pick" title={<><Icon e="🏦" size={20} /> THE COMPANY</>}>
      <div className="stamp good">PAID</div>
      <h2>INSTALLMENT PAID!</h2>
      <p className="dim">
        The Company grants you a <b>Mining Permit</b> for <b>{biome.name}</b>
        {isFinite(permit) ? ` (down to Layer ${permit})` : ' and beyond'}. Choose a reward:
      </p>
      <div className="art-choices">
        {choices.map((id) => {
          const a = ARTIFACT_MAP[id];
          return (
            <button
              key={id}
              className="art-card"
              onClick={() => {
                sfx.buy();
                act((x) => pickArtifact(x, id));
              }}
            >
              <span className="slot huge">
                <Icon e={a.icon} size={56} />
              </span>
              <b>{a.name}</b>
              <span className="dim small">{a.desc}</span>
            </button>
          );
        })}
      </div>
      <button className="link" onClick={() => act((x) => pickArtifact(x, null))}>
        Skip and take {money(50 * g.run.debtIndex)} instead
      </button>
    </Modal>
  );
}

export function DaySummary() {
  const show = useUi((s) => s.showSummary);
  const g = useGame((s) => s.game);
  const sum = g.run.lastSummary;
  if (!show || !sum || g.run.phase !== 'town') return null;
  const close = () => useUi.setState({ showSummary: false });
  const ores = ORES.filter((o) => sum.cargo[o]);
  const value = ores.reduce((s, o) => s + Math.floor((sum.cargo[o] ?? 0) * unitPrice(g, o)), 0);
  return (
    <Modal onClose={close} title={<><Icon e="⛏️" size={20} /> DAY {sum.day} REPORT</>}>
      <h2>BACK ON THE SURFACE</h2>
      <p className="dim">
        Day {sum.day} · Layer {sum.layer} · {sum.tiles} tiles broken · best chain {sum.bestCombo}
      </p>
      <div className="summary-list">
        {ores.map((o) => (
          <div key={o} className="haul-row">
            <TileIcon k={o} size={32} />
            {ORE_INFO[o].name}
            <b>×{fmt(sum.cargo[o]!)}</b>
          </div>
        ))}
        {sum.cash > 0 && (
          <div className="haul-row">
            <Icon e="💰" size={32} /> Cash from chests <b>{money(sum.cash)}</b>
          </div>
        )}
        {sum.relics.map((r, k) => (
          <div key={k} className="haul-row">
            <Icon e={RELIC_MAP[r].icon} size={32} /> {RELIC_MAP[r].name}
          </div>
        ))}
        {ores.length === 0 && !sum.cash && <div className="dim">Nothing. Rough day.</div>}
      </div>
      {value > 0 && (
        <p>
          Today's ore is worth about <b className="gold">{money(value)}</b> at today's prices.
        </p>
      )}
      {sum.newLayer && <p className="blue">You found the stairs: Layer {sum.layer + 1} is open!</p>}
      <RewardButton
        placement="haul"
        label="WATCH AN AD: +50% HAUL"
        onReward={() => {
          const n = useGame.getState().act((x) => adHaul(x));
          if (n > 0) {
            sfx.coin(3);
            toast(`+${fmt(n)} bonus ore in your cart!`, 'good');
          }
        }}
      />
      <Btn kind="gold" className="big" onClick={close}>
        To town
      </Btn>
    </Modal>
  );
}

export function Foreclosure() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  useEffect(() => sfx.foreclose(), []);
  const earnedPart = Math.floor(2 * Math.log2(1 + run.earned / 100) + (run.maxLayer - 1) / 2);
  const clauseMul = clauseBonus(run.clauses);
  return (
    <div className="screen foreclosed">
      <div className="stamp bad">FORECLOSED</div>
      <h1>THE COMPANY TOOK EVERYTHING</h1>
      <p className="dim">Your claim, your tools, your cash. But not what you learned.</p>
      <div className="stat-grid">
        <div>
          <label>Days survived</label>
          <b>{run.day}</b>
        </div>
        <div>
          <label>Installments paid</label>
          <b>{run.debtsPaid}</b>
        </div>
        <div>
          <label>Deepest layer</label>
          <b>{run.maxLayer}</b>
        </div>
        <div>
          <label>Money earned</label>
          <b>{money(run.earned)}</b>
        </div>
        <div>
          <label>Best chain</label>
          <b>{run.bestCombo}</b>
        </div>
        <div>
          <label>Artifacts</label>
          <b className="icons">{run.artifacts.length ? run.artifacts.map((a) => <Icon key={a} e={ARTIFACT_MAP[a].icon} size={24} />) : '–'}</b>
        </div>
      </div>
      <div className="shard-box">
        <div>
          <Icon e="✨" size={32} /> <b>{run.shardsEarned}</b> LEGACY SHARDS
        </div>
        <div className="dim small">
          {earnedPart} from earnings & depth + {run.debtsPaid * 2} from paid installments
          {clauseMul > 0 && (
            <>
              {' '}
              = {baseShards(run)}, ×{(1 + clauseMul).toFixed(2)} from loan clauses
            </>
          )}
        </div>
      </div>
      <RewardButton
        placement="shards"
        label={`WATCH AN AD: +${Math.round(AD_SHARDS * 100)}% SHARDS`}
        onReward={() => {
          const n = act((x) => adShards(x));
          if (n > 0) {
            sfx.relic();
            toast(`+${n} Legacy Shards!`, 'gold');
          }
        }}
      />
      <Btn
        kind="gold"
        className="big"
        onClick={() => {
          sfx.rebirth();
          act((x) => rebirth(x));
        }}
      >
        ✨ REBIRTH
      </Btn>
    </div>
  );
}

function LegacyTree() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  return (
    <div className="cards legacy">
      {LEGACY.map((d) => {
        const lvl = g.meta.legacy[d.id] ?? 0;
        const price = legacyPrice(g, d.id);
        return (
          <div key={d.id} className={`card ${lvl ? 'owned' : ''}`}>
            <div className="card-top">
              <span className="slot">
                <Icon e={d.icon} size={32} />
              </span>
              <div>
                <b>{d.name}</b>
                {isFinite(d.max) ? (
                  <div className="pips">
                    {Array.from({ length: d.max }, (_, k) => (
                      <span key={k} className={k < lvl ? 'on' : ''} />
                    ))}
                  </div>
                ) : (
                  <div className="lvl-text">LV {lvl}</div>
                )}
              </div>
            </div>
            <div className="dim small">{d.desc}</div>
            <Btn
              kind="blue"
              disabled={price === null || g.meta.shards < price}
              onClick={() => {
                if (act((x) => buyLegacy(x, d.id))) sfx.relic();
              }}
            >
              {price === null ? (
                'MAX'
              ) : (
                <>
                  <Icon e="✨" size={16} /> {price}
                </>
              )}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

function ClausePicker() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const on = g.meta.clauses ?? [];
  const bonus = clauseBonus(on);
  return (
    <div className="clauses">
      <h2>LOAN CLAUSES</h2>
      <p className="dim">
        Sign harsher terms for the next loan to earn more shards. Current shard multiplier: <b className={bonus > 0 ? 'gold' : ''}>×{(1 + bonus).toFixed(2)}</b>
      </p>
      <div className="cards">
        {CLAUSES.map((c) => {
          const active = on.includes(c.id);
          return (
            <div key={c.id} className={`card ${active ? 'clause-on' : ''}`}>
              <div className="card-top">
                <span className="slot">
                  <Icon e={c.icon} size={32} />
                </span>
                <div>
                  <b>{c.name}</b>
                  <div className="gold small">+{Math.round(c.bonus * 100)}% shards</div>
                </div>
              </div>
              <div className="dim small">{c.desc}</div>
              <Btn
                kind={active ? 'danger' : 'default'}
                onClick={() => {
                  sfx.click();
                  act((x) => toggleClause(x, c.id));
                }}
              >
                {active ? '✍ SIGNED' : 'SIGN'}
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LegacyScreen() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  return (
    <div className="screen legacy-screen">
      <h1>LEGACY</h1>
      <p className="dim">
        Rebirth #{g.meta.stats.rebirths}. Spend Legacy Shards on permanent upgrades, then start a new claim.
      </p>
      <div className="shard-box">
        <Icon e="✨" size={32} /> <b>{g.meta.shards}</b> SHARDS
      </div>
      <LegacyTree />
      <ClausePicker />
      <Btn
        kind="gold"
        className="big"
        onClick={() => {
          sfx.stairs();
          act((x) => startRun(x));
        }}
      >
        ⛏ BEGIN A NEW RUN
      </Btn>
    </div>
  );
}

function CollectionBook() {
  const relics = useGame((s) => s.game.meta.relics);
  const done = completedSets(relics);
  const owned = Object.keys(relics).length;
  return (
    <>
      <h2>RELIC COLLECTION</h2>
      <p className="dim">
        {owned}/{RELIC_SETS.length * 4} found. Relics persist through rebirth. Each relic gives +1% sell price, and a completed set gives a permanent bonus.
      </p>
      <div className="sets">
        {RELIC_SETS.map((s) => (
          <div key={s.id} className={`set ${done.has(s.id) ? 'done' : ''}`}>
            <div className="set-head">
              <b>{s.name}</b>
              <span className="dim small">{s.where}</span>
            </div>
            <div className="relics">
              {s.relics.map((r) => (
                <div key={r.id} className={`relic ${relics[r.id] ? 'have' : ''}`} title={relics[r.id] ? r.name : '???'}>
                  <span>{relics[r.id] ? <Icon e={r.icon} size={32} /> : '?'}</span>
                  <small>{relics[r.id] ? r.name : '???'}</small>
                </div>
              ))}
            </div>
            <div className={`small ${done.has(s.id) ? 'green' : 'dim'}`}>Set bonus: {s.bonus}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Settings() {
  const { game, muted, setMuted, exportSave, importSave, hardReset } = useGame();
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const st = game.meta.stats;
  const s = derive(game);
  return (
    <>
      <h2>STATS</h2>
      <div className="stat-grid">
        <div>
          <label>Rebirths</label>
          <b>{st.rebirths}</b>
        </div>
        <div>
          <label>Best day</label>
          <b>{Math.max(st.bestDay, game.run.day)}</b>
        </div>
        <div>
          <label>Best chain</label>
          <b>{st.bestCombo}</b>
        </div>
        <div>
          <label>Deepest layer</label>
          <b>{st.deepest}</b>
        </div>
        <div>
          <label>Total earned</label>
          <b>{money(st.totalEarned + game.run.earned)}</b>
        </div>
        <div>
          <label>Biggest win</label>
          <b>{money(st.biggestWin)}</b>
        </div>
      </div>
      <h4>Current bonuses</h4>
      <div className="small dim bonus-list">
        <span>⛏ Power {s.pickPower}</span>
        <span>⚡ Energy {s.maxEnergy}</span>
        <span>💥 Blast {s.blastPower} dmg · radius {s.blastRadius}</span>
        <span>🏮 Vision {s.vision}</span>
        <span>🍀 Luck {s.luck}</span>
        <span>🧭 Ore ×{s.oreBonus.toFixed(2)}</span>
        <span>🤝 Sell ×{s.sellBonus.toFixed(2)}</span>
        <span>🎰 Saloon ×{s.casinoBonus.toFixed(2)}</span>
        <span>📈 Debt growth {s.debtGrowth.toFixed(2)}×</span>
        <span>🪪 This run's shards so far: {calcShards(game.run)}</span>
        {!!game.run.clauses?.length && <span>✍ Loan clauses: ×{(1 + clauseBonus(game.run.clauses)).toFixed(2)} shards</span>}
      </div>
      {import.meta.env.VITE_ADS === 'adsense' && (
        <p className="small dim">
          Optional ads are provided by Google. <a href="https://asked.hu/adatvedelem.html#english" target="_blank" rel="noreferrer">Privacy policy</a>
        </p>
      )}
      <h4>Sound</h4>
      <Btn onClick={() => setMuted(!muted)}>{muted ? '🔇 Muted' : '🔊 Sound on'}</Btn>
      <h4>Save</h4>
      <div className="row gap">
        <Btn onClick={() => setText(exportSave())}>Export</Btn>
        <Btn onClick={() => setText(importSave(text) ? 'Imported!' : 'Invalid save')}>Import</Btn>
      </div>
      <textarea className="save-box" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a save here to import" />
      <h4>Danger zone</h4>
      <Btn
        kind="danger"
        onClick={() => {
          if (!confirm) return setConfirm(true);
          hardReset();
          setConfirm(false);
          useUi.setState({ modal: null });
        }}
      >
        {confirm ? 'Click again to wipe EVERYTHING' : 'Hard reset'}
      </Btn>
    </>
  );
}

function Help() {
  return (
    <>
      <h2>DEEP DEBT</h2>
      <ol className="help">
        <li>
          <b>Every day you descend once.</b> Pick a layer and dig. Each hit costs ⚡ energy. You can only dig tiles touching open ground, and the fog hides what is further down.
        </li>
        <li>
          <b>Chain reactions are everything.</b> Mining an ore collects its whole connected vein. 🧨 TNT explodes, gas pockets ignite their neighbours, crystals shatter in lines, magnets pull in ore, and × tiles boost the chain's multiplier. The longer the chain, the bigger the multiplier on all ore it collects.
        </li>
        <li>
          <b>Watch out for lava.</b> It burns adjacent ore to nothing.
        </li>
        <li>
          <b>Go deeper.</b> Break the 🟦 <b>Stairs</b> on the bottom row with your pickaxe to unlock the next layer. Deeper layers have richer ore and harder rock.
        </li>
        <li>
          <b>Pick a claim.</b> Once you reach Layer 4, the mine offers several claims every morning. Mutators like 🌊 Flooded or 🪨 Crumbling make a dig harder, but every one adds bonus loot.
        </li>
        <li>
          <b>In town</b> sell ore (prices change daily), buy upgrades and tools, and try your luck in the Saloon.
        </li>
        <li>
          <b>The Company</b> wants an installment every few days, and each one is much bigger than the last. Paying in full earns an artifact and a <b>Mining Permit</b> to dig into the next biome. Miss a deadline and you are <b>foreclosed</b>.
        </li>
        <li>
          <b>You will be foreclosed eventually.</b> That's the point: rebirth for ✨ Legacy Shards, buy permanent upgrades, and dig deeper next time. Relics you find stay in your collection forever. Before a new run you can sign <b>loan clauses</b>: harsher terms for more shards.
        </li>
      </ol>
      <Btn kind="gold" onClick={() => useUi.setState({ modal: null })}>
        Let's dig
      </Btn>
    </>
  );
}

export function Modals() {
  const modal = useUi((s) => s.modal);
  const shards = useGame((s) => s.game.meta.shards);
  const close = () => useUi.setState({ modal: null });
  if (!modal) return null;
  return (
    <Modal
      onClose={close}
      wide={modal !== 'help'}
      title={
        {
          collection: <><Icon e="📖" size={20} /> COLLECTION</>,
          settings: <><Icon e="⚙️" size={20} /> STATS & SETTINGS</>,
          help: <><Icon e="❓" size={20} /> HOW TO PLAY</>,
          legacy: <><Icon e="✨" size={20} /> LEGACY</>,
        }[modal]
      }
    >
      {modal === 'collection' && <CollectionBook />}
      {modal === 'settings' && <Settings />}
      {modal === 'help' && <Help />}
      {modal === 'legacy' && (
        <>
          <h2>LEGACY TREE</h2>
          <p className="dim">
            You have <b>{shards}</b> shards. Upgrades apply right away; start-of-run ones (cash, kit, maps, heirloom) apply to your next run.
          </p>
          <LegacyTree />
        </>
      )}
    </Modal>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
