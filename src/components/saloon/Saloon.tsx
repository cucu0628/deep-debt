import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../fx/audio';
import {
  CRATES,
  ROULETTE_PAY,
  ROULETTE_SLOTS,
  SLOT_PAIR,
  SLOT_SYMBOLS,
  SLOT_TRIPLE,
  cratePrice,
  hiloCashout,
  hiloGuess,
  hiloMult,
  hiloOdds,
  hiloStart,
  openCrate,
  rouletteColor,
  spinRoulette,
  spinSlots,
  type CrateResult,
  type CrateTier,
  type RouletteBet,
  type SlotSymbol,
} from '../../game/casino';
import { ARTIFACT_MAP } from '../../game/data/artifacts';
import { RELIC_MAP } from '../../game/data/relics';
import { TOOLS, type ToolId } from '../../game/data/upgrades';
import { derive } from '../../game/stats';
import { CARD_NAMES, money } from '../../format';
import { toast, useGame, useUi } from '../../store';
import { BetPicker, Btn, Icon } from '../common';
import { RewardButton } from '../RewardButton';
import { adCrate } from '../../game/rewards';

const SYM: Record<SlotSymbol, string> = { coal: '🪨', copper: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', tnt: '🧨' };

function useTimers() {
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
      useUi.setState({ heldCash: null });
    },
    [],
  );
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

function useBet(initial = 25) {
  const cash = useGame((s) => s.game.run.cash);
  const [bet, setBet] = useState(() => Math.max(1, Math.min(initial, Math.floor(cash) || 1)));
  return [bet, setBet, cash] as const;
}

function Slots() {
  const act = useGame((s) => s.act);
  const [bet, setBet, cash] = useBet();
  const [reels, setReels] = useState<SlotSymbol[]>(['diamond', 'diamond', 'diamond']);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: string } | null>(null);
  const later = useTimers();

  const spin = () => {
    if (spinning) return;
    const before = useGame.getState().game.run.cash;
    const res = act((g) => spinSlots(g, bet));
    if (!res) return sfx.error();
    useUi.setState({ heldCash: before - bet });
    setSpinning(true);
    setMsg(null);
    const stopped = [false, false, false];
    const iv = window.setInterval(() => {
      setReels((r) => r.map((s, k) => (stopped[k] ? s : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])));
      sfx.tick();
    }, 70);
    [650, 950, 1250].forEach((ms, k) =>
      later(() => {
        stopped[k] = true;
        setReels((r) => r.map((s, j) => (j === k ? res.reels[k] : s)));
        sfx.hit();
      }, ms),
    );
    later(() => {
      clearInterval(iv);
      setSpinning(false);
      useUi.setState({ heldCash: null });
      if (res.win > 0) {
        const big = res.mult >= 15;
        sfx.win(big);
        setMsg({ text: `${big ? 'JACKPOT! ' : ''}You win ${money(res.win)}`, kind: big ? 'jackpot' : 'good' });
      } else {
        sfx.lose();
        setMsg({ text: res.reels.includes('tnt') ? 'KABOOM. Nothing.' : 'No luck.', kind: 'bad' });
      }
      if (res.artifact) toast(`Jackpot artifact: ${ARTIFACT_MAP[res.artifact].icon} ${ARTIFACT_MAP[res.artifact].name}!`, 'gold');
      if (res.relic) toast(`Lucky relic: ${RELIC_MAP[res.relic].icon} ${RELIC_MAP[res.relic].name}`, 'gold');
    }, 1350);
  };

  return (
    <div className="game-box">
      <div className={`reels ${spinning ? 'spinning' : ''}`}>
        {reels.map((s, k) => (
          <div key={k} className="reel">
            <Icon e={SYM[s]} size={64} />
          </div>
        ))}
      </div>
      {msg && <div className={`result ${msg.kind}`}>{msg.text}</div>}
      <BetPicker cash={cash} bet={bet} setBet={setBet} disabled={spinning} />
      <Btn kind="gold" className="big" disabled={spinning || bet <= 0 || bet > cash} onClick={spin}>
        SPIN · {money(bet)}
      </Btn>
      <div className="paytable">
        {SLOT_SYMBOLS.filter((s) => s !== 'tnt').map((s) => (
          <div key={s} className="pay-row">
            <span>
              <Icon e={SYM[s]} size={20} />
              <Icon e={SYM[s]} size={20} />
              <Icon e={SYM[s]} size={20} />
            </span>
            <b>×{SLOT_TRIPLE[s]}</b>
            <span className="dim">two ×{SLOT_PAIR[s]}</span>
          </div>
        ))}
        <div className="dim small">3× 💎 also grants an artifact · 3× 🥇 a lucky relic · 🧨 pays nothing</div>
      </div>
    </div>
  );
}

function HighLow() {
  const act = useGame((s) => s.act);
  const hilo = useGame((s) => s.game.run.hilo);
  const bonus = useGame((s) => derive(s.game).casinoBonus);
  const [bet, setBet, cash] = useBet();
  const [flip, setFlip] = useState(0);
  const [bust, setBust] = useState<{ from: number; to: number } | null>(null);

  const deal = () => {
    if (!act((g) => hiloStart(g, bet))) return sfx.error();
    setBust(null);
    setFlip((f) => f + 1);
    sfx.tick();
  };
  const guess = (dir: 'hi' | 'lo') => {
    const from = hilo!.card;
    const r = act((g) => hiloGuess(g, dir));
    if (!r) return sfx.error();
    setFlip((f) => f + 1);
    if (r.won) sfx.break(useGame.getState().game.run.hilo?.streak ?? 1);
    else {
      sfx.lose();
      setBust({ from, to: r.next });
    }
  };
  const cashout = () => {
    const paid = act((g) => hiloCashout(g));
    if (paid > 0) {
      sfx.win(paid > 10 * (hilo?.bet ?? 0));
      toast(`Cashed out ${money(paid)}`, 'good');
    }
  };

  if (!hilo) {
    return (
      <div className="game-box">
        {bust ? (
          <div className="cards-row">
            <div className="playing-card">{CARD_NAMES[bust.from]}</div>
            <span className="arrow">→</span>
            <div className="playing-card bust" key={flip}>
              {CARD_NAMES[bust.to]}
            </div>
          </div>
        ) : (
          <div className="cards-row">
            <div className="playing-card back">?</div>
          </div>
        )}
        {bust && <div className="result bad">BUST! The pot is gone.</div>}
        <div className="dim small center">Guess whether the next card is higher or lower. Each correct guess multiplies the pot. Ties lose. Cash out any time.</div>
        <BetPicker cash={cash} bet={bet} setBet={setBet} />
        <Btn kind="gold" className="big" disabled={bet <= 0 || bet > cash} onClick={deal}>
          DEAL · {money(bet)}
        </Btn>
      </div>
    );
  }
  const mh = hiloMult(hilo.card, 'hi');
  const ml = hiloMult(hilo.card, 'lo');
  return (
    <div className="game-box">
      <div className="cards-row">
        <div className="playing-card flip" key={flip}>
          {CARD_NAMES[hilo.card]}
        </div>
      </div>
      <div className="pot">
        Pot <b>{money(hilo.pot)}</b> · streak {hilo.streak}
      </div>
      <div className="row gap center">
        <Btn kind="good" disabled={mh <= 0} onClick={() => guess('hi')}>
          ▲ HIGHER ×{mh} <small>({Math.round(hiloOdds(hilo.card, 'hi') * 100)}%)</small>
        </Btn>
        <Btn kind="danger" disabled={ml <= 0} onClick={() => guess('lo')}>
          ▼ LOWER ×{ml} <small>({Math.round(hiloOdds(hilo.card, 'lo') * 100)}%)</small>
        </Btn>
      </div>
      <Btn kind="gold" className="big" disabled={hilo.streak === 0} onClick={cashout}>
        CASH OUT {money(hilo.streak ? Math.floor(hilo.bet + (hilo.pot - hilo.bet) * bonus) : 0)}
      </Btn>
    </div>
  );
}

function crateText(r: CrateResult): string {
  switch (r.kind) {
    case 'cash':
      return `${money(r.amount)} in cash`;
    case 'tools':
      return Object.entries(r.tools)
        .map(([t, n]) => `${n}× ${TOOLS[t as ToolId].icon} ${TOOLS[t as ToolId].name}`)
        .join(', ');
    case 'relic':
      return `${RELIC_MAP[r.id].icon} ${RELIC_MAP[r.id].name}${r.dupe ? ' (duplicate, sold)' : '!'}`;
    case 'artifact':
      return `ARTIFACT: ${ARTIFACT_MAP[r.id].icon} ${ARTIFACT_MAP[r.id].name}!`;
  }
}

function Crates() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const [opening, setOpening] = useState<CrateTier | null>(null);
  const [result, setResult] = useState<{ tier: CrateTier; res: CrateResult } | null>(null);
  const later = useTimers();

  const open = (tier: CrateTier, free = false) => {
    if (opening) return;
    const before = useGame.getState().game.run.cash;
    const price = free ? 0 : cratePrice(g, tier);
    const res = free ? act((x) => adCrate(x)) : act((x) => openCrate(x, tier));
    if (!res) return sfx.error();
    useUi.setState({ heldCash: before - price });
    setOpening(tier);
    setResult(null);
    for (let k = 0; k < 8; k++) later(() => sfx.tick(), k * 100);
    later(() => {
      setOpening(null);
      useUi.setState({ heldCash: null });
      setResult({ tier, res });
      if (res.kind === 'artifact' || res.kind === 'relic') sfx.relic();
      else if (res.kind === 'cash' && res.amount > price) sfx.win(res.amount > price * 1.5);
      else sfx.chest();
    }, 900);
  };

  return (
    <div className="game-box">
      <div className="crates">
        {(Object.keys(CRATES) as CrateTier[]).map((tier) => {
          const c = CRATES[tier];
          const price = cratePrice(g, tier);
          const total = c.odds.cash + c.odds.tools + c.odds.relic + c.odds.artifact;
          return (
            <div key={tier} className={`crate crate-${tier} ${opening === tier ? 'shaking' : ''}`}>
              <div className="crate-box">
                <Icon e={tier === 'gold' ? '🎁' : '📦'} size={56} />
              </div>
              <b>{c.name}</b>
              <div className="dim small">
                Cash {Math.round((c.odds.cash / total) * 100)}% · Tools {Math.round((c.odds.tools / total) * 100)}%
                <br />
                Relic {Math.round((c.odds.relic / total) * 100)}% · Artifact {Math.round((c.odds.artifact / total) * 100)}%
              </div>
              <Btn kind="gold" disabled={!!opening || g.run.cash < price} onClick={() => open(tier)}>
                OPEN · {money(price)}
              </Btn>
            </div>
          );
        })}
      </div>
      {!opening && (
        <div className="row center-row">
          <RewardButton placement="crate" label="WATCH AN AD: FREE SILVER CRATE" onReward={() => open('silver', true)} />
        </div>
      )}
      {result && <div className={`result ${result.res.kind === 'artifact' || result.res.kind === 'relic' ? 'jackpot' : 'good'}`}>{crateText(result.res)}</div>}
      <div className="dim small center">Crate prices rise with every installment you pay.</div>
    </div>
  );
}

const CELL = 64;
const CYCLES = 8;

function Roulette() {
  const act = useGame((s) => s.act);
  const unlocked = useGame((s) => !!s.game.meta.legacy.roulette);
  const [bet, setBet, cash] = useBet();
  const [pos, setPos] = useState(ROULETTE_SLOTS * CELL);
  const [anim, setAnim] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: string } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const later = useTimers();

  if (!unlocked) {
    return (
      <div className="game-box center">
        <Icon e="🎡" size={64} />
        <div>Roulette is for High Rollers only.</div>
        <div className="dim small">Unlock it in the Legacy tree (✨).</div>
      </div>
    );
  }

  const spin = (choice: RouletteBet) => {
    if (anim) return;
    const before = useGame.getState().game.run.cash;
    const res = act((g) => spinRoulette(g, bet, choice));
    if (!res) return sfx.error();
    useUi.setState({ heldCash: before - bet });
    setMsg(null);
    const width = strip.current?.parentElement?.clientWidth ?? 400;
    const target = (CYCLES - 2) * ROULETTE_SLOTS + res.slot;
    const jitter = (Math.random() - 0.5) * CELL * 0.6;
    setAnim(true);
    setPos(target * CELL - width / 2 + CELL / 2 + jitter);
    for (let k = 0; k < 14; k++) later(() => sfx.tick(), k * k * 14);
    later(() => {
      setAnim(false);
      setPos(ROULETTE_SLOTS * CELL + res.slot * CELL - width / 2 + CELL / 2 + jitter);
      useUi.setState({ heldCash: null });
      if (res.win > 0) {
        sfx.win(choice === 'green');
        setMsg({ text: `${rouletteColor(res.slot).toUpperCase()}! You win ${money(res.win)}`, kind: choice === 'green' ? 'jackpot' : 'good' });
      } else {
        sfx.lose();
        setMsg({ text: `${rouletteColor(res.slot).toUpperCase()}. You lose.`, kind: 'bad' });
      }
    }, 3100);
  };

  return (
    <div className="game-box">
      <div className="roulette">
        <div className="roulette-marker" />
        <div
          ref={strip}
          className="roulette-strip"
          style={{ transform: `translateX(${-pos}px)`, transition: anim ? 'transform 3s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none' }}
        >
          {Array.from({ length: ROULETTE_SLOTS * CYCLES }, (_, k) => {
            const n = k % ROULETTE_SLOTS;
            return (
              <div key={k} className={`rslot ${rouletteColor(n)}`} style={{ width: CELL }}>
                {n}
              </div>
            );
          })}
        </div>
      </div>
      {msg && <div className={`result ${msg.kind}`}>{msg.text}</div>}
      <BetPicker cash={cash} bet={bet} setBet={setBet} disabled={anim} />
      <div className="row gap center">
        {(['red', 'black', 'green'] as RouletteBet[]).map((c) => (
          <Btn key={c} kind={c === 'red' ? 'danger' : c === 'green' ? 'good' : 'default'} disabled={anim || bet <= 0 || bet > cash} onClick={() => spin(c)}>
            {c.toUpperCase()} ×{ROULETTE_PAY[c]}
          </Btn>
        ))}
      </div>
    </div>
  );
}

type Game = 'slots' | 'hilo' | 'crates' | 'roulette';

export function Saloon() {
  const [game, setGame] = useState<Game>('slots');
  const hiloActive = useGame((s) => !!s.game.run.hilo);
  const dry = useGame((s) => !!s.game.run.clauses?.includes('dry'));
  if (dry) {
    return (
      <div className="center-col">
        <Icon e="🚱" size={64} />
        <p>CLOSED BY ORDER OF THE COMPANY.</p>
        <p className="dim">You signed the Prohibition clause for this loan. No gambling this run.</p>
      </div>
    );
  }
  const list: [Game, string, string][] = [
    ['slots', '🎰', 'SLOTS'],
    ['hilo', '🃏', `HIGH-LOW${hiloActive ? ' •' : ''}`],
    ['crates', '📦', 'CRATES'],
    ['roulette', '🎡', 'ROULETTE'],
  ];
  return (
    <div className="saloon">
      <div className="subtabs">
        {list.map(([id, icon, label]) => (
          <button
            key={id}
            className={`subtab ${game === id ? 'on' : ''}`}
            onClick={() => {
              sfx.click();
              setGame(id);
            }}
          >
            <Icon e={icon} size={20} /> {label}
          </button>
        ))}
      </div>
      {game === 'slots' && <Slots />}
      {game === 'hilo' && <HighLow />}
      {game === 'crates' && <Crates />}
      {game === 'roulette' && <Roulette />}
      <div className="dim small center">In-game money only. The house always has an edge.</div>
    </div>
  );
}
