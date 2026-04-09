import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'The Field — Blackmoor',
  description: 'Temporarily at rest.',
};

// AR encounter is temporarily disabled during the Raven Post sprint
// (2026-04-08 → 2026-04-19). The component files have been renamed
// to *.tsx.disabled and will be restored after the sprint merges.
// Restore by: git mv app/ar/AREncounter.tsx.disabled app/ar/AREncounter.tsx
// (and the same for ARViewer, ModelViewer) and restore the original
// page.tsx from git history.

export default function ARPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif flex flex-col">
      <nav className="sticky top-0 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-6 py-2.5 flex items-center gap-3 text-sm z-10">
        <Link
          href="/"
          title="Shadow of the Wolf"
          className="block rounded-full overflow-hidden flex-shrink-0"
          style={{ width: 30, height: 30 }}
        >
          <Image
            src="/images/invite/dice_home.png"
            alt="Home"
            width={30}
            height={30}
            className="object-cover rounded-full"
          />
        </Link>
        <span className="text-[var(--color-gold)]">The Field</span>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-[860px] mx-auto w-full text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] mb-4">
          At rest
        </p>
        <h1 className="text-3xl font-serif text-[var(--color-text)] mb-4">
          The Field is Quiet
        </h1>
        <div className="w-full flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-[var(--color-gold)] text-xs">✦</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <p className="text-[var(--color-text-body)] font-serif italic">
          Nothing stirs here for now. The field will wake again soon.
        </p>
      </div>
    </div>
  );
}
