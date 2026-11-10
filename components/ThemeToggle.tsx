'use client';

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  }
  return (
    <button type="button" className="btn secondary" onClick={toggle} aria-label="Skift mellem lys og mørk tilstand">
      Lys/mørk
    </button>
  );
}
