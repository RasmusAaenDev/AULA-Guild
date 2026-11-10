'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function DetailsMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = ref.current;
      if (el && el.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && ref.current) ref.current.open = false;
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return <details ref={ref} className={className}>{children}</details>;
}
