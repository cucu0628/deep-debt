import { useRef, useState } from 'react';
import { sfx } from '../fx/audio';
import { biomeFor } from '../game/data/biomes';
import {
  SKILL_BY_ID,
  SKILL_NODES,
  nodeDesc,
  nodeIcon,
  nodeLevels,
  nodeSpan,
  nodeState,
  perkCost,
  upNodeCost,
  upgradeDef,
  type Branch,
  type SkillNode,
} from '../game/data/skilltree';
import { buySkill } from '../game/run';
import { derive } from '../game/stats';
import { fmt, money } from '../format';
import { useGame } from '../store';
import { Btn, Icon } from './common';

const CELL_W = 84;
const CELL_H = 88;
const NODE = 52;
const PAD_TOP = 26;

const BRANCHES: { id: Branch; name: string; col: number }[] = [
  { id: 'mining', name: 'MINING', col: 0 },
  { id: 'blasting', name: 'BLASTING', col: 3 },
  { id: 'fortune', name: 'FORTUNE', col: 6 },
  { id: 'wealth', name: 'WEALTH', col: 9 },
  { id: 'crew', name: 'CREW', col: 12 },
  { id: 'saloon', name: 'SALOON', col: 15 },
];

const cx = (n: SkillNode) => n.col * CELL_W + CELL_W / 2;
const cy = (n: SkillNode) => PAD_TOP + n.row * CELL_H + CELL_H / 2;
const cost = (n: SkillNode, run: Parameters<typeof nodeState>[1]) => (n.kind === 'up' ? upNodeCost(n, run) : perkCost(n, run));

export function SkillTree() {
  const g = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const run = g.run;
  const stats = derive(g);
  const [sel, setSel] = useState<string>('pick1');
  const [zoom, setZoom] = useState(0.8);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null);

  const cols = Math.max(...SKILL_NODES.map((n) => n.col)) + 1;
  const rows = Math.max(...SKILL_NODES.map((n) => n.row)) + 1;
  const W = cols * CELL_W;
  const H = PAD_TOP + rows * CELL_H;

  const node = SKILL_BY_ID[sel];
  const state = nodeState(node, run);
  const span = nodeSpan(node);
  const got = nodeLevels(node, run);
  const price = cost(node, run);
  const lvl = node.kind === 'up' ? (run.upgrades[node.upgrade] ?? 0) : got;
  const total = SKILL_NODES.filter((n) => nodeState(n, run) === 'purchased').length;

  const zoomBy = (d: number) => setZoom((z) => Math.max(0.4, Math.min(1.5, Math.round((z + d) * 10) / 10)));

  return (
    <div className="skilltree">
      <div className="tree-wrap">
        <div className="tree-bar small">
          <span className="dim">
            {total}/{SKILL_NODES.length} nodes maxed · drag to pan · wheel / buttons to zoom
          </span>
          <span>
            <Btn onClick={() => zoomBy(-0.1)}>−</Btn> <Btn onClick={() => setZoom(0.8)}>{Math.round(zoom * 100)}%</Btn>{' '}
            <Btn onClick={() => zoomBy(0.1)}>+</Btn>
          </span>
        </div>
        <div
          className="tree-scroll"
          ref={scroller}
          onWheel={(e) => {
            if (e.ctrlKey || e.altKey || e.shiftKey) return;
            zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
          }}
          onPointerDown={(e) => {
            const s = scroller.current!;
            drag.current = { x: e.clientX, y: e.clientY, l: s.scrollLeft, t: s.scrollTop, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || !(e.buttons & 1)) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
            scroller.current!.scrollLeft = d.l - dx;
            scroller.current!.scrollTop = d.t - dy;
          }}
          onPointerUp={() => setTimeout(() => (drag.current = null))}
          onPointerLeave={() => (drag.current = null)}
        >
          <div style={{ width: W * zoom, height: H * zoom }}>
            <div className="tree" style={{ width: W, height: H, transform: `scale(${zoom})` }}>
              {BRANCHES.map((b) => (
                <div key={b.id} className={`tree-band br-${b.id}`} style={{ left: b.col * CELL_W, width: CELL_W * 3, height: H }}>
                  <span>{b.name}</span>
                </div>
              ))}
              <svg className="tree-lines" width={W} height={H}>
                {SKILL_NODES.flatMap((n) =>
                  n.parents.map((pid) => {
                    const p = SKILL_BY_ID[pid];
                    const lit = nodeState(n, run) !== 'locked' || nodeLevels(n, run) > 0;
                    const cross = p.branch !== n.branch && p.branch !== 'core';
                    return (
                      <line
                        key={`${pid}-${n.id}`}
                        x1={cx(p)}
                        y1={cy(p)}
                        x2={cx(n)}
                        y2={cy(n)}
                        className={`${lit ? 'lit' : ''} ${cross ? 'cross' : ''}`}
                      />
                    );
                  }),
                )}
              </svg>
              {SKILL_NODES.map((n) => {
                const st = nodeState(n, run);
                const sp = nodeSpan(n);
                const size = n.keystone ? NODE + 16 : NODE;
                return (
                  <button
                    key={n.id}
                    className={`tnode ${st} br-${n.branch} ${n.keystone ? 'key' : ''} ${sel === n.id ? 'sel' : ''}`}
                    style={{ left: cx(n) - size / 2, top: cy(n) - size / 2, width: size, height: size }}
                    title={n.name}
                    onClick={() => {
                      if (drag.current?.moved) return;
                      setSel(n.id);
                    }}
                  >
                    <Icon e={st === 'locked' ? '🔒' : nodeIcon(n)} size={n.keystone ? 34 : 26} />
                    <span className="tnode-n">
                      {nodeLevels(n, run)}
                      {Number.isFinite(sp) ? `/${sp}` : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className={`card tree-info ${node.keystone ? 'key' : ''}`}>
        <div className="card-top">
          <span className="slot">
            <Icon e={nodeIcon(node)} size={32} />
          </span>
          <div>
            <b>{node.name}</b>
            <div className="lvl">
              {got}
              {Number.isFinite(span) ? `/${span}` : ''}
              {node.kind === 'up' && ` · LV ${lvl}${Number.isFinite(upgradeDef(node.upgrade).max) ? `/${upgradeDef(node.upgrade).max}` : ''}`}
            </div>
          </div>
        </div>
        <div className="dim small">{nodeDesc(node)}</div>
        {node.parents.length > 0 && (
          <div className="small">Requires: {node.parents.map((p) => SKILL_BY_ID[p].name).join(' + ')}</div>
        )}
        {node.kind === 'up' && node.upgrade === 'miner' && lvl > 0 && (
          <div className="small">
            {fmt(lvl * stats.minerOre)} ore/day from {biomeFor(run.maxLayer).name}
          </div>
        )}
        <Btn
          kind="gold"
          disabled={price === null || run.cash < price}
          onClick={() => {
            if (act((x) => buySkill(x, node.id))) sfx.buy();
          }}
        >
          {state === 'purchased' ? 'MAX' : state === 'locked' ? 'LOCKED' : price === null ? '—' : money(price)}
        </Btn>
      </div>
    </div>
  );
}
