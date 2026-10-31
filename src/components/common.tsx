import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../fx/audio';
import { emojiIconURL, tileIconURL } from '../fx/sprites';
import type { TileKind } from '../game/data/tiles';
import { fmt } from '../format';

export function AnimatedNumber({ value, prefix = '', className }: { value: number; prefix?: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    if (value > a) setBump((b) => b + 1);
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 550);
      const e = 1 - Math.pow(1 - t, 3);
      const v = a + (value - a) * e;
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span key={bump} className={`num ${bump ? 'bump' : ''} ${className ?? ''}`}>
      {prefix}
      {fmt(Math.round(shown))}
    </span>
  );
}

/** An emoji redrawn as a crisp pixel-art icon. */
export function Icon({ e, size = 24, className }: { e: string; size?: number; className?: string }) {
  const url = emojiIconURL(e);
  if (!url)
    return (
      <span className={`px-icon ${className ?? ''}`} style={{ fontSize: size * 0.8, width: size, height: size }}>
        {e}
      </span>
    );
  return <img className={`px-icon ${className ?? ''}`} src={url} width={size} height={size} alt="" draggable={false} />;
}

export function TileIcon({ k, size = 24 }: { k: TileKind; size?: number }) {
  return <img className="px-icon" src={tileIconURL(k)} width={size} height={size} alt="" draggable={false} />;
}

export function Modal({
  children,
  onClose,
  wide,
  title,
  className,
}: {
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  title?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`window ${wide ? 'wide' : ''} ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="window-title">
          <span>{title ?? ''}</span>
          {onClose && (
            <button
              className="window-x"
              onClick={() => {
                sfx.click();
                onClose();
              }}
            >
              ×
            </button>
          )}
        </div>
        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  kind = 'default',
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: 'default' | 'gold' | 'danger' | 'good' | 'ghost' | 'blue';
  className?: string;
  title?: string;
}) {
  return (
    <button
      className={`btn btn-${kind} ${className ?? ''}`}
      disabled={disabled}
      title={title}
      onClick={() => {
        sfx.click();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function BetPicker({ cash, bet, setBet, disabled }: { cash: number; bet: number; setBet: (n: number) => void; disabled?: boolean }) {
  const presets: [string, number][] = [
    ['10%', Math.floor(cash * 0.1)],
    ['25%', Math.floor(cash * 0.25)],
    ['50%', Math.floor(cash * 0.5)],
    ['ALL', Math.floor(cash)],
  ];
  return (
    <div className="bet">
      <div className="bet-row">
        <button className="btn sm" disabled={disabled} onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))}>
          ½
        </button>
        <div className="bet-input">
          <span>BET $</span>
          <input type="number" min={1} value={bet} disabled={disabled} onChange={(e) => setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
        </div>
        <button className="btn sm" disabled={disabled} onClick={() => setBet(Math.max(1, bet * 2))}>
          ×2
        </button>
      </div>
      <div className="bet-row">
        {presets.map(([label, v]) => (
          <button key={label} className="btn sm" disabled={disabled || v <= 0} onClick={() => setBet(v)}>
            {label}
          </button>
        ))}
      </div>
      {bet > cash && <div className="warn">Not enough cash (you have ${fmt(cash)})</div>}
    </div>
  );
}

/** A chunky segmented progress bar. */
export function Bar({ value, max, color, segments = 20 }: { value: number; max: number; color: string; segments?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value / Math.max(1, max))) * segments);
  return (
    <div className="seg-bar">
      {Array.from({ length: segments }, (_, k) => (
        <span key={k} style={k < filled ? { background: color } : undefined} className={k < filled ? 'on' : ''} />
      ))}
    </div>
  );
}
