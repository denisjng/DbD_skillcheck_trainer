import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/useGame';
import { useSettings } from '../store/useSettings';
import { describeBinding, eventToBinding, type Binding } from '../engine/input';
import { audio } from '../engine/audio';

export function Settings() {
  const setScreen = useGame((s) => s.setScreen);
  const bindings = useSettings((s) => s.bindings);
  const addBinding = useSettings((s) => s.addBinding);
  const removeBinding = useSettings((s) => s.removeBinding);
  const setBindings = useSettings((s) => s.setBindings);
  const volume = useSettings((s) => s.volume);
  const setVolume = useSettings((s) => s.setVolume);
  const muted = useSettings((s) => s.muted);
  const setMuted = useSettings((s) => s.setMuted);
  const custom = useSettings((s) => s.custom);
  const setCustom = useSettings((s) => s.setCustom);

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
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('mousedown', onMouse, { capture: true });
    window.addEventListener('contextmenu', onCtx, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      window.removeEventListener('mousedown', onMouse, { capture: true });
      window.removeEventListener('contextmenu', onCtx, { capture: true });
    };
  }, [capturing, addBinding]);

  // Live audio settings
  useEffect(() => { audio.setVolume(volume); }, [volume]);
  useEffect(() => { audio.setMuted(muted); }, [muted]);

  const presets: { label: string; b: Binding }[] = [
    { label: 'Space', b: 'Space' },
    { label: 'Left Click', b: 'Mouse0' },
    { label: 'Right Click', b: 'Mouse2' },
    { label: 'Middle Click', b: 'Mouse1' },
    { label: 'Tab', b: 'Tab' },
    { label: 'Enter', b: 'Enter' },
    { label: 'F', b: 'KeyF' },
    { label: 'J', b: 'KeyJ' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col vignette grain overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>← Back</button>
        <div className="label">Settings</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 fade-in">
        <div className="max-w-3xl mx-auto space-y-10">

          <section>
            <div className="label mb-2">Skillcheck Bind</div>
            <p className="opacity-70 text-sm mb-4">Press any of the bound keys / buttons to hit a skill check. Multiple binds are allowed.</p>
            <div className="flex flex-wrap gap-2 mb-3" ref={captureBoxRef}>
              {bindings.map((b) => (
                <span key={b} className="panel px-3 py-2 flex items-center gap-2">
                  <span className="font-mono">{describeBinding(b)}</span>
                  <button
                    className="opacity-60 hover:opacity-100"
                    onClick={() => bindings.length > 1 && removeBinding(b)}
                    title={bindings.length > 1 ? 'Remove' : 'You must keep at least one bind'}
                    disabled={bindings.length <= 1}
                  >×</button>
                </span>
              ))}
              <button
                className={`btn ${capturing ? 'btn-primary pulse-ring' : ''}`}
                onClick={() => setCapturing((c) => !c)}
              >
                {capturing ? 'Press any key / button…' : '+ Add Bind'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="label w-full mb-1">Quick presets</div>
              {presets.map((p) => (
                <button
                  key={p.b}
                  className="btn"
                  onClick={() => setBindings([p.b])}
                  title={`Replace all binds with ${p.label}`}
                >{p.label}</button>
              ))}
            </div>
          </section>

          <section>
            <div className="label mb-2">Audio</div>
            <div className="flex items-center gap-4 mb-3">
              <button className="btn" onClick={() => setMuted(!muted)}>{muted ? 'Unmute' : 'Mute'}</button>
              <input
                className="flex-1 accent-[var(--color-blood-bright)]"
                type="range" min={0} max={1} step={0.01}
                value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
              <span className="font-mono w-12 text-right">{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => { audio.ensure().then(() => audio.play('warning')); }}>Test gong</button>
              <button className="btn" onClick={() => { audio.ensure().then(() => audio.play('great')); }}>Test great</button>
              <button className="btn" onClick={() => { audio.ensure().then(() => audio.play('miss')); }}>Test miss</button>
            </div>
          </section>

          <section>
            <div className="label mb-2">Custom Practice (used by "Custom Practice" mode)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <NumberRow label="Great zone size"      value={custom.greatFraction}    min={0.005} max={0.2}  step={0.005} fmt={(v)=>`${(v*100).toFixed(1)}%`} onChange={(v) => setCustom({ greatFraction: v })} />
              <NumberRow label="Good zone size"       value={custom.goodFraction}     min={0.02}  max={0.4}  step={0.005} fmt={(v)=>`${(v*100).toFixed(1)}%`} onChange={(v) => setCustom({ goodFraction: v })} />
              <NumberRow label="Rotation seconds"     value={custom.rotationSeconds}  min={0.4}   max={3}    step={0.05}  fmt={(v)=>`${v.toFixed(2)}s`}      onChange={(v) => setCustom({ rotationSeconds: v })} />
              <NumberRow label="Warning lead (ms)"    value={custom.warningLeadMs}    min={0}     max={1000} step={20}    fmt={(v)=>`${v}ms`}                onChange={(v) => setCustom({ warningLeadMs: v })} />
              <NumberRow label="Reverse chance"       value={custom.reverseChance}    min={0}     max={1}    step={0.05}  fmt={(v)=>`${Math.round(v*100)}%`} onChange={(v) => setCustom({ reverseChance: v })} />
              <NumberRow label="Off-center chance"    value={custom.offCenterChance}  min={0}     max={1}    step={0.05}  fmt={(v)=>`${Math.round(v*100)}%`} onChange={(v) => setCustom({ offCenterChance: v })} />
              <NumberRow label="Silent chance"        value={custom.silentChance}     min={0}     max={1}    step={0.05}  fmt={(v)=>`${Math.round(v*100)}%`} onChange={(v) => setCustom({ silentChance: v })} />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function NumberRow({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm opacity-80">{label}</span>
        <span className="text-sm font-mono">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--color-blood-bright)]"
      />
    </div>
  );
}
