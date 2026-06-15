// Unified key + mouse binding format. We use a string token system:
//   "Space", "Tab", "Enter", "KeyF", "KeyJ", "ShiftLeft", ...   (KeyboardEvent.code)
//   "Mouse0" (left), "Mouse1" (middle), "Mouse2" (right)
// Multiple bindings are stored as an array — any one triggers a hit.

export type Binding = string;

export function describeBinding(b: Binding): string {
  if (b === 'Space') return 'Space';
  if (b === 'Tab') return 'Tab';
  if (b === 'Enter') return 'Enter';
  if (b.startsWith('Mouse')) {
    const n = Number(b.slice(5));
    return ['Left Click', 'Middle Click', 'Right Click', 'Mouse 4', 'Mouse 5'][n] ?? `Mouse ${n}`;
  }
  if (b.startsWith('Key')) return b.slice(3);
  if (b.startsWith('Digit')) return b.slice(5);
  if (b.startsWith('Arrow')) return b.replace('Arrow', '');
  if (b === 'ShiftLeft') return 'L Shift';
  if (b === 'ShiftRight') return 'R Shift';
  if (b === 'ControlLeft') return 'L Ctrl';
  if (b === 'ControlRight') return 'R Ctrl';
  if (b === 'AltLeft') return 'L Alt';
  if (b === 'AltRight') return 'R Alt';
  return b;
}

export function eventToBinding(e: KeyboardEvent | MouseEvent): Binding | null {
  if (e instanceof KeyboardEvent) {
    if (!e.code) return null;
    return e.code;
  }
  if (e instanceof MouseEvent) {
    return `Mouse${e.button}`;
  }
  return null;
}

export function preventBindingDefault(b: Binding): boolean {
  // Default-prevent these so the browser doesn't scroll/tab-away while training
  return b === 'Space' || b === 'Tab' || b.startsWith('Arrow') || b === 'Mouse1' || b === 'Mouse2';
}
