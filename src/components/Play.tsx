import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';
import { applyDifficulty, MODE_BY_ID } from '../engine/modes';
import { SkillCheckEngine, type Outcome, type RunStats } from '../engine/SkillCheckEngine';
import { audio } from '../engine/audio';
import { HorrorOverlay } from './HorrorOverlay';

export function Play() {
  const setScreen = useGame((s) => s.setScreen);
  const modeId = useGame((s) => s.selectedModeId);
  const difficulty = useSettings((s) => s.difficulty);
  const bindings = useSettings((s) => s.bindings);
  const custom = useSettings((s) => s.custom);
  const recordBest = useSettings((s) => s.recordBest);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SkillCheckEngine | null>(null);
  const bindingsRef = useRef<string[]>(bindings);
  useEffect(() => { bindingsRef.current = bindings; }, [bindings]);
  // Snapshot custom + recordBest into refs so the engine effect only re-fires
  // when the user actively changes mode/difficulty/runKey.
  const customRef = useRef(custom);
  useEffect(() => { customRef.current = custom; }, [custom]);
  const recordBestRef = useRef(recordBest);
  useEffect(() => { recordBestRef.current = recordBest; }, [recordBest]);

  const [stats, setStats] = useState<RunStats>({
    attempts: 0, greats: 0, goods: 0, misses: 0, timeouts: 0,
    streak: 0, bestStreak: 0, reactionMsAvg: 0, reactionMsLast: 0,
  });
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null);
  const [endReason, setEndReason] = useState<'failcap' | 'marathon' | 'stopped' | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [horrorToken, setHorrorToken] = useState(0);

  useEffect(() => {
    audio.ensure();
  }, []);

  useEffect(() => {
    setStats({
      attempts: 0, greats: 0, goods: 0, misses: 0, timeouts: 0,
      streak: 0, bestStreak: 0, reactionMsAvg: 0, reactionMsLast: 0,
    });
    setLastOutcome(null);
    setEndReason(null);

    const mode = MODE_BY_ID[modeId];
    const spec = mode.id === 'custom'
      ? { ...mode.base, ...customRef.current }
      : applyDifficulty(mode, difficulty);

    const engine = new SkillCheckEngine(mode, spec, bindingsRef, {
      onOutcome: (o, s) => {
        setLastOutcome(o);
        setStats({ ...s });
      },
      onRunEnd: (reason, s) => {
        setEndReason(reason);
        setStats({ ...s });
        const acc = s.attempts > 0 ? s.greats / s.attempts : 0;
        recordBestRef.current(`${mode.id}|${difficulty}`, s.bestStreak, acc);
      },
      onHorror: () => setHorrorToken((t) => t + 1),
    });
    engine.attach(canvasRef.current!);
    engine.start();
    engineRef.current = engine;
    return () => engine.detach();
  }, [modeId, difficulty, runKey]);

  const mode = MODE_BY_ID[modeId];
  const acc = stats.attempts > 0 ? (stats.greats / stats.attempts) * 100 : 0;
  const goodAcc = stats.attempts > 0 ? ((stats.greats + stats.goods) / stats.attempts) * 100 : 0;

  return (
    <div className="relative w-full h-full vignette grain">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <button
          className="btn btn-ghost"
          onClick={() => { engineRef.current?.stop('stopped'); setScreen('modes'); }}
        >← End Run</button>
        <div className="text-center">
          <div className="label">{mode.name}</div>
          <div className="text-xs opacity-60 uppercase tracking-widest">{difficulty}</div>
        </div>
        <div style={{ width: 130 }} />
      </div>

      {/* Stats overlay */}
      <div className="absolute top-20 left-6 z-10 fade-in">
        <div className="panel px-4 py-3 space-y-1 min-w-[180px]">
          <Row label="Streak" value={String(stats.streak)} accent={lastOutcome === 'great' ? '#c1121f' : undefined} />
          <Row label="Best" value={String(stats.bestStreak)} />
          <Row label="Greats" value={`${stats.greats} / ${stats.attempts}`} />
          <Row label="Accuracy" value={`${acc.toFixed(1)}%`} />
          <Row label="Hit rate" value={`${goodAcc.toFixed(1)}%`} />
          <Row label="React (ms)" value={`${stats.reactionMsLast} avg ${stats.reactionMsAvg}`} />
        </div>
      </div>

      {/* Bindings reminder */}
      <div className="absolute top-20 right-6 z-10 fade-in">
        <div className="panel px-4 py-3">
          <div className="label mb-1">Hit with</div>
          <div className="flex gap-2 flex-wrap max-w-[260px] justify-end">
            {bindings.map((b) => (
              <span key={b} className="font-mono text-sm border border-[var(--color-border)] px-2 py-0.5">{describe(b)}</span>
            ))}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      <HorrorOverlay token={horrorToken} />

      {endReason && (
        <ResultsOverlay
          reason={endReason}
          stats={stats}
          onRetry={() => { setRunKey((k) => k + 1); }}
          onMenu={() => setScreen('modes')}
        />
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="label">{label}</span>
      <span className="font-mono text-lg" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function describe(b: string): string {
  if (b === 'Space') return 'Space';
  if (b.startsWith('Mouse')) return ['LMB','MMB','RMB','M4','M5'][Number(b.slice(5))] ?? b;
  if (b.startsWith('Key')) return b.slice(3);
  return b;
}

function ResultsOverlay({
  reason, stats, onRetry, onMenu,
}: {
  reason: 'failcap' | 'marathon' | 'stopped';
  stats: RunStats;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const acc = stats.attempts > 0 ? (stats.greats / stats.attempts) * 100 : 0;
  const title = reason === 'marathon' ? 'Marathon Complete' : reason === 'failcap' ? 'Run Ended' : 'Stopped';
  const tone = reason === 'marathon' ? '#74a85f' : '#c1121f';
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 fade-in">
      <div className="panel p-8 min-w-[360px]">
        <div className="label">Results</div>
        <h2
          className="text-3xl font-bold tracking-wider mb-6"
          style={{ fontFamily: 'var(--font-display)', color: tone }}
        >{title}</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Big label="Streak best" value={String(stats.bestStreak)} />
          <Big label="Greats" value={String(stats.greats)} />
          <Big label="Goods" value={String(stats.goods)} />
          <Big label="Misses" value={String(stats.misses + stats.timeouts)} />
          <Big label="Accuracy" value={`${acc.toFixed(1)}%`} />
          <Big label="Avg react" value={`${stats.reactionMsAvg}ms`} />
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={onMenu}>Mode select</button>
          <button className="btn btn-primary" onClick={onRetry}>Run again</button>
        </div>
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}
