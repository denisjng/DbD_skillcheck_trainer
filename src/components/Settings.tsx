import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';
import { describeBinding, eventToBinding, type Binding } from '../engine/input';
import { audio } from '../engine/audio';

export function Settings() {
  const setScreen     = useGame((s) => s.setScreen);
  const bindings      = useSettings((s) => s.bindings);
  const addBinding    = useSettings((s) => s.addBinding);
  const removeBinding = useSettings((s) => s.removeBinding);
  const setBindings   = useSettings((s) => s.setBindings);
  const volume        = useSettings((s) => s.volume);
  const setVolume     = useSettings((s) => s.setVolume);
  const muted         = useSettings((s) => s.muted);
  const setMuted      = useSettings((s) => s.setMuted);
  const custom        = useSettings((s) => s.custom);
  const setCustom     = useSettings((s) => s.setCustom);

  const [capturing, setCapturing] = useState(false);
  const captureBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') { setCapturing(false); return; }
      const b = eventToBinding(e);
      if (b) { addBinding(b); setCapturing(false); }
    };
    const onMouse = (e: MouseEvent) => {
      if (!captureBoxRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      const b = eventToBinding(e);
      if (b) { addBinding(b); setCapturing(false); }
    };
    const onCtx = (e: MouseEvent) => {
      if (captureBoxRef.current?.contains(e.target as Node)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey,  { capture: true });
    window.addEventListener('mousedown', onMouse, { capture: true });
    window.addEventListener('contextmenu', onCtx, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey,  { capture: true });
      window.removeEventListener('mousedown', onMouse, { capture: true });
      window.removeEventListener('contextmenu', onCtx, { capture: true });
    };
  }, [capturing, addBinding]);

  useEffect(() => { audio.setVolume(volume); }, [volume]);
  useEffect(() => { audio.setMuted(muted); },  [muted]);

  const presets: { label: string; b: Binding }[] = [
    { label: 'Space',        b: 'Space'  },
    { label: 'Left Click',   b: 'Mouse0' },
    { label: 'Right Click',  b: 'Mouse2' },
    { label: 'Middle Click', b: 'Mouse1' },
    { label: 'Tab',          b: 'Tab'    },
    { label: 'Enter',        b: 'Enter'  },
    { label: 'F',            b: 'KeyF'   },
    { label: 'J',            b: 'KeyJ'   },
  ];

  return (
    <div className="dbd-screen vignette grain flex flex-col overflow-hidden">

      {/* Top bar */}
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
        <span className="section-label" style={{ letterSpacing: '0.3em' }}>Settings</span>
        <div style={{ width: 80 }} />
      </div>

      {/* Scrollable body */}
      <div className="relative z-10 flex-1 overflow-y-auto fade-in">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-0">

          {/* ── Keybind ── */}
          <Section title="Skill Check Bind">
            <p style={{ fontSize: '0.78rem', color: 'var(--color-bone-dim)', marginBottom: '14px', lineHeight: 1.6 }}>
              Press any bound key or button to hit a skill check. Multiple binds are allowed.
            </p>
            <div ref={captureBoxRef} className="flex flex-wrap gap-2 mb-3">
              {bindings.map((b) => (
                <span
                  key={b}
                  className="panel flex items-center gap-2"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                    {describeBinding(b)}
                  </span>
                  <button
                    style={{
                      opacity: 0.5,
                      fontSize: '1rem',
                      lineHeight: 1,
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: bindings.length > 1 ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => bindings.length > 1 && removeBinding(b)}
                    disabled={bindings.length <= 1}
                    title={bindings.length > 1 ? 'Remove' : 'At least one bind required'}
                    onMouseEnter={(e) => { if (bindings.length > 1) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                className={`btn ${capturing ? 'btn-primary pulse-ring' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                onClick={() => setCapturing((c) => !c)}
              >
                {capturing ? 'Press any key / button…' : '+ Add Bind'}
              </button>
            </div>

            <p className="label mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.b}
                  className="btn"
                  style={{ padding: '5px 12px', fontSize: '0.7rem' }}
                  onClick={() => setBindings([p.b])}
                  title={`Replace all binds with ${p.label}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Audio ── */}
          <Section title="Audio">
            <div className="flex items-center gap-4 mb-4">
              <button
                className="btn"
                style={{ padding: '6px 16px', fontSize: '0.75rem', minWidth: 80 }}
                onClick={() => setMuted(!muted)}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1"
                style={{ accentColor: 'var(--color-blood-bright)' }}
              />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', width: 40, textAlign: 'right' }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
            <div className="flex gap-2">
              {[
                { label: 'Test Gong',  fn: () => audio.ensure().then(() => audio.play('warning')) },
                { label: 'Test Great', fn: () => audio.ensure().then(() => audio.play('great'))   },
                { label: 'Test Miss',  fn: () => audio.ensure().then(() => audio.play('miss'))    },
              ].map((t) => (
                <button key={t.label} className="btn" style={{ padding: '5px 14px', fontSize: '0.72rem' }} onClick={t.fn}>
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Custom Practice ── */}
          <Section title="Custom Practice">
            <p style={{ fontSize: '0.78rem', color: 'var(--color-bone-dim)', marginBottom: '14px', lineHeight: 1.6 }}>
              Used by the "Custom Practice" mode.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <SliderRow label="Great zone size"    value={custom.greatFraction}   min={0.005} max={0.2}  step={0.005} fmt={(v) => `${(v*100).toFixed(1)}%`}      onChange={(v) => setCustom({ greatFraction: v })} />
              <SliderRow label="Good zone size"     value={custom.goodFraction}    min={0.02}  max={0.4}  step={0.005} fmt={(v) => `${(v*100).toFixed(1)}%`}      onChange={(v) => setCustom({ goodFraction: v })} />
              <SliderRow label="Rotation speed"     value={custom.rotationSeconds} min={0.4}   max={3}    step={0.05}  fmt={(v) => `${v.toFixed(2)}s / rev`}       onChange={(v) => setCustom({ rotationSeconds: v })} />
              <SliderRow label="Warning lead"       value={custom.warningLeadMs}   min={0}     max={1000} step={20}    fmt={(v) => `${v}ms`}                       onChange={(v) => setCustom({ warningLeadMs: v })} />
              <SliderRow label="Reverse chance"     value={custom.reverseChance}   min={0}     max={1}    step={0.05}  fmt={(v) => `${Math.round(v*100)}%`}        onChange={(v) => setCustom({ reverseChance: v })} />
              <SliderRow label="Off-center chance"  value={custom.offCenterChance} min={0}     max={1}    step={0.05}  fmt={(v) => `${Math.round(v*100)}%`}        onChange={(v) => setCustom({ offCenterChance: v })} />
              <SliderRow label="Silent chance"      value={custom.silentChance}    min={0}     max={1}    step={0.05}  fmt={(v) => `${Math.round(v*100)}%`}        onChange={(v) => setCustom({ silentChance: v })} />
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}

/* ---- Section wrapper with DbD-style header ---- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: '32px', marginBottom: '32px', borderBottom: '1px solid var(--color-border-hi)' }}>
      <div className="dbd-rule mb-5"><span>◆</span></div>
      <p className="section-label mb-4">{title}</p>
      {children}
    </div>
  );
}

/* ---- Slider row ---- */
function SliderRow({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span style={{ fontSize: '0.75rem', color: 'var(--color-bone-dim)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', color: 'var(--color-amber)' }}>
          {fmt(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--color-blood-bright)' }}
      />
    </div>
  );
}
