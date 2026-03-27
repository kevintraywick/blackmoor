import DmNav from '@/components/DmNav';

export default function PoisonsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="poisons" />
      <div className="max-w-[640px] mx-auto px-8 py-12">
        <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight">Poisons & Traps</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-6">
          Hazards · Effects · Encounter Notes
        </p>
        <div className="border-t border-[var(--color-border)] pt-6 text-[#5a4a44] text-sm font-serif italic">
          Poisons, traps, and environmental hazards. Stats, save DCs, and effects. Coming soon.
        </div>
      </div>
    </div>
  );
}
