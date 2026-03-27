import DmNav from '@/components/DmNav';

export default function MagicPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="magic" />
      <div className="max-w-[640px] mx-auto px-8 py-12">
        <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight">Magic</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-6">
          Spells · Scrolls · Arcane Items
        </p>
        <div className="border-t border-[var(--color-border)] pt-6 text-[#5a4a44] text-sm font-serif italic">
          Track discovered spells, copied scrolls, and magic items. Coming soon.
        </div>
      </div>
    </div>
  );
}
