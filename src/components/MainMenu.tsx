import { useGame } from '../store/useGame';

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="relative w-full h-full flex items-center justify-center vignette grain">
      <div className="text-center fade-in no-select">
        <div className="label mb-3">Dead by Daylight</div>
        <h1
          className="text-5xl md:text-7xl font-bold tracking-widest text-shadow"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-bone)' }}
        >
          SKILLCHECK
        </h1>
        <h2
          className="text-3xl md:text-5xl font-bold tracking-[0.4em] mt-1 text-shadow"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-blood-bright)' }}
        >
          TRAINER
        </h2>
        <div className="mt-12 flex flex-col gap-3 items-center min-w-[280px]">
          <button className="btn btn-primary w-full" onClick={() => setScreen('modes')}>Play</button>
          <button className="btn w-full" onClick={() => setScreen('settings')}>Settings</button>
          <a
            className="btn btn-ghost w-full"
            href="https://deadbydaylight.wiki.gg/wiki/Skill_Checks"
            target="_blank"
            rel="noreferrer"
          >Wiki</a>
        </div>
        <div className="mt-10 text-xs opacity-60">v0.1 — Fan-made trainer. Not affiliated with Behaviour Interactive.</div>
      </div>
    </div>
  );
}
