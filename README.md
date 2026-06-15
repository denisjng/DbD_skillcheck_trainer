# DbD Skillcheck Trainer

A web-based trainer for Dead by Daylight skill checks. Fan-made — not affiliated with Behaviour Interactive.

## Run

```
npm install
npm run dev
```

Then open the URL Vite prints (defaults to http://localhost:5173).

## Stack

- Vite + React 19 + TypeScript
- Tailwind v4
- Zustand (state + localStorage persistence)
- HTML5 Canvas + RAF for the dial (zero React in the hot path → ≤1-frame input latency)
- Web Audio API (procedural cues, no binary assets)

## Modes

| Mode | Notes |
| --- | --- |
| Classic Repair | Default repair skill checks |
| Healing | Tighter zones |
| Overcharge | Tiny great zone, precision |
| Unnerving Presence | All zones shrink |
| Hex: Huntress Lullaby | No warning gong, near-zero lead |
| Doctor Madness | Off-center + counter-clockwise mixed in |
| Merciless Storm | Continuous, one miss ends the run |
| Wiggle (Old) | Two opposed zones (3 + 9 o'clock) |
| Decisive Strike | One-shot, fast |
| Endless | Run until first miss |
| Marathon (50 in a row) | 50 great hits in a row, any miss/good resets |
| Custom Practice | Tune every parameter from Settings |

Each (except Storm / DS / Custom) scales by **Easy / Normal / Hard / Nightmare**.

## Keybinds

Configure in **Settings**. Add any keyboard key or mouse button (LMB, RMB, MMB).
Multiple binds can be active at once — any of them hits the check. Defaults to **Space**.

## Stats tracked per run

- Streak / best streak
- Greats / goods / misses / timeouts
- Accuracy (greats / attempts)
- Hit rate (greats + goods / attempts)
- Reaction time (last + running average)
- Personal bests persisted to localStorage per (mode, difficulty)
