import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';
import { applyDifficulty, MODE_BY_ID } from '../engine/modes';
import { SkillCheckEngine, type Outcome, type RunStats } from '../engine/SkillCheckEngine';
import { audio } from '../engine/audio';
import { HorrorOverlay } from './HorrorOverlay';

export function Play() {
  const setScreen  = useGame((s) => s.setScreen);
  const modeId     = useGame((s) => s.selectedModeId);
  const difficulty = useSettings((s) => s.difficulty);
  const bindings   = useSettings((s) => s.bindings);
  const custom     = useSettings((s) => s.custom);
  const recordBest = useSettings((s) => s.recordBest);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const engineRef    = useRef<SkillCheckEngine | null>(null);
  const bindingsRef  = useRef<string[]>(bindings);
  useEffect(() => { bindingsRef.current = bindings; }, [bindings]);
  const customRef    = useRef(custom);
  useEffect(() => { customRef.current = custom; }, [custom]);
  const recordBestRef = useRef(recordBest);
  useEffect(() => { recordBestRef.current = recordBest; }, [recordBest]);

  const [stats, setStats] = useState<RunStats>({
    attempts: 0, greats: 0, goods: 0, misses: 0, timeouts: 0,
    streak: 0, bestStreak: 0, reactionMsAvg: 0, reactionMsLast: 0,
  });
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null);
  const [endReason, setEndReason]     = useState<'failcap' | 'marathon' | 'stopped' | null>(null);
  const [runKey, setRunKey]           = useState(0);
  const [horrorToken, setHorrorToken] = useState(0);

  useEffect(() => { audio.ensure(); }, []);

  useEffect(() => {
    setStats({ attempts: 0, greats: 0, goods: 0, misses: 0, timeouts: 0,
               streak: 0, bestStreak: 0, reactionMsAvg: 0, reactionMsLast: 0 });
    setLastOutcome(null);
    setEndReason(null);

    const mode = MODE_BY_ID[modeId];
    const spec = mode.id === 'custom'
      ? { ...mode.base, ...customRef.current }
      : applyDifficulty(mode, difficulty);

    const engine = new SkillCheckEngine(mode, spec, bindingsRef, {
      onOutcome: (o, s) => { setLastOutcome(o); setStats({ ...s }); },
      onRunEnd:  (reason, s) => {
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

  const mode    = MODE_BY_ID[modeId];
  const goodAcc = stats.attempts > 0
    ? ((stats.greats + stats.goods) / stats.attempts) * 100
    : 0;

  const accentColor = lastOutcome === 'great' ? 'var(--color-blood-bright)' : undefined;

  return (
    <div className="dbd-screen vignette grain">

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3"
        style={{
          borderBottom: '1px solid var(--color-border-hi)',
          background: 'linear-gradient(180deg,rgba(16,14,10,0.95) 0%,rgba(10,9,7,0.85) 100%)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <button
          className="btn btn-ghost text-xs py-1.5 px-3"
          onClick={() => { engineRef.current?.stop('stopped'); setScreen('modes'); }}
        >
          ← End Run
        </button>
        <div className="text-center">
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              color: 'var(--color-bone)',
              textTransform: 'uppercase',
            }}
          >
            {mode.name}
          </div>
          <div className="label mt-0.5" style={{ letterSpacing: '0.22em' }}>{difficulty}</div>
        </div>
        <div style={{ width: 88 }} />
      </div>

      {/* ── Desktop stat panel (left) ── */}
      <div className="absolute top-20 left-5 z-10 fade-in hidden sm:block">
        <div className="panel" style={{ minWidth: 170, padding: '12px 16px' }}>
          <div className="dbd-rule mb-3" style={{ opacity: 0.5 }}><span>◆</span></div>
          <StatRow label="Streak"  value={String(stats.streak)}             accent={accentColor} />
          <StatRow label="Best"    value={String(stats.bestStreak)} />
          <StatRow label="Greats"  value={`${stats.greats} / ${stats.attempts}`} />
          <StatRow label="Hit %"   value={`${goodAcc.toFixed(1)}%`} />
        </div>
      </div>

      {/* ── Desktop bind reminder (right) ── */}
      <div className="absolute top-20 right-5 z-10 fade-in hidden sm:block">
        <div className="panel" style={{ padding: '10px 14px' }}>
          <div className="label mb-2">Hit with</div>
          <div className="flex gap-1.5 flex-wrap justify-end" style={{ maxWidth: 220 }}>
            {bindings.map((b) => (
              <span
                key={b}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                  border: '1px solid var(--color-border-hi)',
                  padding: '3px 8px',
                  color: 'var(--color-bone-dim)',
                }}
              >
                {describe(b)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile compact strip (bottom) ── */}
      <div className="absolute bottom-5 left-4 right-4 z-10 fade-in sm:hidden">
        <div className="panel flex justify-around items-center" style={{ padding: '8px 12px' }}>
          <MobileStat label="Streak" value={String(stats.streak)} accent={accentColor} />
          <MobileStat label="Best"   value={String(stats.bestStreak)} />
          <MobileStat label="Greats" value={`${stats.greats}/${stats.attempts}`} />
          <MobileStat label="Hit%"   value={`${goodAcc.toFixed(0)}%`} />
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />

      <HorrorOverlay token={horrorToken} />

      {endReason && (
        <ResultsOverlay
          reason={endReason}
          stats={stats}
          onRetry={() => setRunKey((k) => k + 1)}
          onMenu={() => setScreen('modes')}
        />
      )}
    </div>
  );
}

/* ---- Desktop stat row ---- */
function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: '6px' }}>
      <span className="label">{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1rem',
          color: accent ?? 'var(--color-bone)',
          transition: 'color 200ms ease',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ---- Mobile compact stat ---- */
function MobileStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="label" style={{ fontSize: '0.55rem' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.9rem',
          color: accent ?? 'var(--color-bone)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function describe(b: string): string {
  if (b === 'Space') return 'Space';
  if (b.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'M4', 'M5'][Number(b.slice(5))] ?? b;
  if (b.startsWith('Key')) return b.slice(3);
  return b;
}

/* ---- Results overlay ---- */
function ResultsOverlay({ reason, stats, onRetry, onMenu }: {
  reason: 'failcap' | 'marathon' | 'stopped';
  stats: RunStats;
  onRetry: () => void;
  onMenu:  () => void;
}) {
  const acc   = stats.attempts > 0 ? (stats.greats / stats.attempts) * 100 : 0;
  const title = reason === 'marathon' ? 'Marathon Complete' : reason === 'failcap' ? 'Run Ended' : 'Stopped';
  const tone  = reason === 'marathon' ? '#74a85f' : 'var(--color-blood-bright)';

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center fade-in"
      style={{ background: 'rgba(0,0,0,0.78)' }}
    >
      <div className="panel" style={{ padding: '40px 48px', minWidth: 360, maxWidth: '90vw' }}>
        {/* Header */}
        <div className="dbd-rule mb-5"><span>◆</span></div>
        <p className="section-label mb-2">Results</p>
        <h2
          className="text-shadow mb-6"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            color: tone,
          }}
        >
          {title}
        </h2>

        {/* Stats grid */}
        <div
          className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8"
          style={{ borderTop: '1px solid var(--color-border-hi)', paddingTop: '20px' }}
        >
          <ResultStat label="Best Streak" value={String(stats.bestStreak)} />
          <ResultStat label="Greats"      value={String(stats.greats)} />
          <ResultStat label="Goods"       value={String(stats.goods)} />
          <ResultStat label="Misses"      value={String(stats.misses + stats.timeouts)} />
          <ResultStat label="Accuracy"    value={`${acc.toFixed(1)}%`} />
          <ResultStat label="Avg React"   value={`${stats.reactionMsAvg}ms`} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button className="btn" style={{ padding: '8px 20px' }} onClick={onMenu}>
            Mode Select
          </button>
          <button className="btn btn-primary glow-blood" style={{ padding: '8px 20px' }} onClick={onRetry}>
            Run Again
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-bone)' }}>
        {value}
      </div>
    </div>
  );
}
