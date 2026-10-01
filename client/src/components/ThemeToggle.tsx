'use client';

import { useState } from 'react';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  const toggle = () => {
    const current = readTheme();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setMounted(true);
    applyTheme(next);
    try {
      localStorage.setItem('agile.theme', next);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Chuyển sang ${theme === 'dark' ? 'sáng' : 'tối'}` : 'Đổi giao diện sáng hoặc tối'}
      title={mounted ? (theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối') : 'Đổi giao diện sáng hoặc tối'}
      className={
        'p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground transition-colors ' +
        className
      }
    >
      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
        {mounted ? (theme === 'dark' ? 'light_mode' : 'dark_mode') : 'contrast'}
      </span>
    </button>
  );
}
