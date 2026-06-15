import { useEffect } from 'react';
import { useGame } from './store/useGame';
import { useSettings } from './store/useSettings';
import { MainMenu } from './components/MainMenu';
import { ModeSelect } from './components/ModeSelect';
import { Settings } from './components/Settings';
import { Play } from './components/Play';
import { audio } from './engine/audio';

export default function App() {
  const screen = useGame((s) => s.screen);
  const volume = useSettings((s) => s.volume);
  const muted = useSettings((s) => s.muted);

  // Initialize audio on first user gesture, then keep volume in sync.
  useEffect(() => {
    const init = () => {
      audio.ensure().then(() => {
        audio.setVolume(volume);
        audio.setMuted(muted);
      });
      window.removeEventListener('pointerdown', init);
      window.removeEventListener('keydown', init);
    };
    window.addEventListener('pointerdown', init);
    window.addEventListener('keydown', init);
    return () => {
      window.removeEventListener('pointerdown', init);
      window.removeEventListener('keydown', init);
    };
  }, [volume, muted]);

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[var(--color-bg)]">
      {screen === 'menu' && <MainMenu />}
      {screen === 'modes' && <ModeSelect />}
      {screen === 'settings' && <Settings />}
      {screen === 'playing' && <Play />}
    </div>
  );
}
