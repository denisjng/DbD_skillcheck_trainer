import { MODES, type Difficulty } from '../engine/modes';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';

const DIFFICULTIES: { id: Difficulty; label: string; color: string }[] = [
  { id: 'easy',      label: 'Easy',      color: '#74a85f' },
  { id: 'normal',    label: 'Normal',    color: '#d4c4a4' },
  { id: 'hard',      label: 'Hard',      color: '#d49b3a' },
  { id: 'nightmare', label: 'Nightmare', color: '#c01020' },
];

export function ModeSelect() {
  const setScreen = useGame((s) => s.setScreen);
  const setMode   = useGame((s) => s.setMode);
  const selectedModeId = useGame((s) => s.selectedModeId);
  const difficulty     = useSettings((s) => s.difficulty);
  const setDifficulty  = useSettings((s) => s.setDifficulty);
  const bests          = useSettings((s) => s.bests);

  const selected = MODES.find((m) => m.id === selectedModeId) ?? MODES[0];

  return (
    <div className="dbd-screen vignette grain flex flex-col">
      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3 shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border-hi)',
          background: 'linear-gradient(180deg,var(--color-panel-2) 0%,var(--color-panel) 100%)',
        }}
      >
        <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={() => setScreen('menu')}>
          ← Back
        </button>
        <span className="section-label" style={{ letterSpacing: '0.3em' }}>Select Mode</span>
        <button className="btn text-xs py-1.5 px-3" onClick={() => setScreen('settings')}>
          Settings
        </button>
      </div>

      {/* ── Two-column body ── */}
      <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-[minmax(200px,280px)_1fr] overflow-hidden">

        {/* Left column: mode list */}
        <div
          className="overflow-y-auto"
          style={{ borderRight: '1px solid var(--color-border-hi)' }}
        >
          {MODES.map((m) => {
            const isSel = m.id === selected.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="w-full text-left transition-all"
                style={{
                  display: 'block',
                  padding: '12px 20px 12px 18px',
                  borderBottom: '1px solid var(--color-border)',
                  borderLeft: isSel
                    ? '2px solid var(--color-amber)'
                    : '2px solid transparent',
                  background: isSel
                    ? 'linear-gradient(90deg,rgba(200,131,44,0.09) 0%,transparent 70%)'
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: isSel ? 'var(--color-bone)' : 'var(--color-bone-dim)',
                    marginBottom: '2px',
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)', lineHeight: 1.3 }}>
                  {m.short}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right column: mode detail */}
        <div className="overflow-y-auto p-7 md:p-10 fade-in" key={selected.id}>

          {/* Mode heading */}
          <div className="mb-7">
            <div className="dbd-rule mb-5"><span>◆</span></div>
            <p className="section-label mb-3">{selected.id}</p>
            <h2
              className="text-shadow mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem,3.5vw,2.5rem)',
                fontWeight: 900,
                letterSpacing: '0.06em',
                color: 'var(--color-bone)',
              }}
            >
              {selected.name}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-bone-dim)', lineHeight: 1.65 }}>
              {selected.description}
            </p>
            <div className="dbd-rule mt-6"><span>◆</span></div>
          </div>

          {/* Difficulty */}
          <div className="mb-7">
            <p className="section-label mb-3">Difficulty</p>
            <div className="grid grid-cols-4 gap-1.5">
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className="btn"
                    style={{
                      padding: '0.55rem 0.4rem',
                      fontSize: '0.7rem',
                      letterSpacing: '0.1em',
                      borderColor: active ? d.color : 'var(--color-border-hi)',
                      color: active ? d.color : 'var(--color-muted)',
                      background: active
                        ? `linear-gradient(180deg,${d.color}15 0%,${d.color}08 100%)`
                        : undefined,
                      textShadow: active ? `0 0 14px ${d.color}99` : undefined,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal best */}
          {bests[`${selected.id}|${difficulty}`] && (
            <div className="panel p-4 mb-7">
              <p className="section-label mb-3">Personal Best</p>
              <div className="flex gap-8">
                <Stat
                  label="Best Streak"
                  value={String(bests[`${selected.id}|${difficulty}`].bestStreak)}
                />
                <Stat
                  label="Best Accuracy"
                  value={`${(bests[`${selected.id}|${difficulty}`].bestAccuracy * 100).toFixed(1)}%`}
                />
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            className="btn btn-primary glow-blood"
            style={{
              padding: '0.9rem 2.5rem',
              fontSize: '0.85rem',
              letterSpacing: '0.28em',
            }}
            onClick={() => setScreen('playing')}
          >
            ▶ Start Run
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.6rem',
          fontWeight: 700,
          color: 'var(--color-bone)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
