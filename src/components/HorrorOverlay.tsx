import { useEffect, useState } from 'react';

// Doctor's "horror" flash that takes over the screen on a failed Madness check.
// React-owned so it survives even if the engine stops on the same frame.

export function HorrorOverlay({ token }: { token: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (token === 0) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 850);
    return () => window.clearTimeout(t);
  }, [token]);

  if (!visible) return null;

  return (
    <div className="horror-overlay no-select pointer-events-none" aria-hidden>
      <div className="horror-vignette" />
      <div className="horror-strobe" />
      <div className="horror-static" />
      <div className="horror-text">
        <span className="horror-text-cyan">SNAP OUT OF IT</span>
        <span className="horror-text-red">SNAP OUT OF IT</span>
        <span className="horror-text-white">SNAP OUT OF IT</span>
      </div>
    </div>
  );
}
