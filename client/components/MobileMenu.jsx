'use client';

import { useEffect, useId, useRef, useState } from 'react';

// Shows a menu button on phones. On tablets and laptops the links are always visible.
// Escape closes the menu and returns focus to the button. Choosing a link also closes it.
export function MobileMenu({ label, closeLabel, children }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function closeIfLink(event) {
    if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="glass-panel glow-border flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-gold/50 px-3 py-1.5 text-xs font-bold text-ink transition hover:border-gold/80 active:scale-95"
      >
        {open ? closeLabel : label}
      </button>
      {open ? (
        <div
          id={panelId}
          onClick={closeIfLink}
          className="absolute left-4 right-4 top-16 z-50 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-paper/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
