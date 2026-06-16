import { useGame } from '../store/useGame';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="dbd-screen vignette grain no-select">
      {/* Centered content column */}
      <div
        className="relative z-10 h-full flex flex-col items-center justify-center fade-in"
        style={{ gap: 0 }}
      >
        {/* Decorative rule above title */}
        <div className="dbd-rule mb-8" style={{ width: 240 }}>
          <span>◆</span>
        </div>

        {/* Game label */}
        <p className="section-label mb-5" style={{ letterSpacing: '0.38em' }}>
          Dead by Daylight
        </p>

        {/* Title */}
        <h1
          className="text-shadow text-center"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-bone)',
            fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
            fontWeight: 900,
            letterSpacing: '0.2em',
            lineHeight: 1.05,
          }}
        >
          SKILLCHECK
        </h1>
        <h2
          className="text-shadow text-center mt-2"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-blood-bright)',
            fontSize: 'clamp(1.4rem, 4vw, 2.6rem)',
            fontWeight: 700,
            letterSpacing: '0.45em',
          }}
        >
          TRAINER
        </h2>

        {/* Decorative rule below title */}
        <div className="dbd-rule mt-8 mb-14" style={{ width: 240 }}>
          <span>◆</span>
        </div>

        {/* Navigation buttons */}
        <nav className="flex flex-col items-center gap-2.5">
          <button
            className="btn btn-hero btn-primary glow-blood"
            onClick={() => setScreen('modes')}
          >
            Play
          </button>
          <button
            className="btn btn-hero"
            onClick={() => setScreen('settings')}
          >
            Settings
          </button>
          <a
            className="btn btn-hero btn-ghost"
            href="https://deadbydaylight.wiki.gg/wiki/Skill_Checks"
            target="_blank"
            rel="noreferrer"
          >
            Wiki
          </a>
        </nav>

        {/* Footer */}
        <p
          className="label absolute bottom-5 opacity-30"
          style={{ fontSize: '0.55rem', letterSpacing: '0.15em' }}
        >
          v0.2 · Fan-made trainer · Not affiliated with Behaviour Interactive
        </p>
      </div>
    </div>
  );
}
