import { MODES, type Difficulty } from '../engine/modes';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';

const DIFFICULTIES: { id: Difficulty; label: string; tone: string }[] = [
  { id: 'easy',      label: 'Easy',      tone: '#74a85f' },
  { id: 'normal',    label: 'Normal',    tone: '#e8d8c4' },
  { id: 'hard',      label: 'Hard',      tone: '#d49b3a' },
  { id: 'nightmare', label: 'Nightmare', tone: '#c1121f' },
];

export function ModeSelect() {
  const setScreen = useGame((s) => s.setScreen);
  const setMode = useGame((s) => s.setMode);
  const selectedModeId = useGame((s) => s.selectedModeId);
  const difficulty = useSettings((s) => s.difficulty);
  const setDifficulty = useSettings((s) => s.setDifficulty);
  const bests = useSettings((s) => s.bests);

  const selected = MODES.find((m) => m.id === selectedModeId) ?? MODES[0];

  return (
    <div className="relative w-full h-full flex flex-col vignette grain">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>← Back</button>
        <div className="label">Select Mode</div>
        <button className="btn" onClick={() => setScreen('settings')}>Settings</button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] overflow-hidden">
        <div className="overflow-y-auto p-4 space-y-2 border-r border-[var(--color-border)]">
          {MODES.map((m) => {
            const isSel = m.id === selected.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full text-left px-4 py-3 border transition-all ${
                  isSel
                    ? 'border-[var(--color-blood)] bg-[rgba(193,18,31,0.08)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-amber)] bg-[var(--color-panel)]'
                }`}
              >
                <div className="font-semibold tracking-wide">{m.name}</div>
                <div className="text-xs opacity-70 mt-0.5">{m.short}</div>
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto p-8 fade-in">
          <div className="label mb-2">Mode</div>
          <h2 className="text-3xl font-bold tracking-wide mb-2" style={{ fontFamily: 'var(--font-display)' }}>{selected.name}</h2>
          <p className="opacity-80 leading-relaxed mb-6">{selected.description}</p>

          <div className="label mb-2">Difficulty</div>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`btn ${difficulty === d.id ? 'btn-primary' : ''}`}
                style={difficulty === d.id ? { borderColor: d.tone, color: '#fff' } : { color: d.tone }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {bests[`${selected.id}|${difficulty}`] && (
            <div className="panel p-4 mb-6">
              <div className="label mb-2">Personal Best</div>
              <div className="flex gap-6">
                <Stat label="Best streak" value={String(bests[`${selected.id}|${difficulty}`].bestStreak)} />
                <Stat label="Best accuracy" value={`${(bests[`${selected.id}|${difficulty}`].bestAccuracy * 100).toFixed(1)}%`} />
              </div>
            </div>
          )}

          <button
            className="btn btn-primary glow-blood text-lg px-8 py-4"
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
      <div className="label">{label}</div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}
