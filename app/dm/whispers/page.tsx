import DmNav from '@/components/DmNav';
import RavenOverheardQueue from '@/components/dm/RavenOverheardQueue';

export default function WhispersPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="whispers" />

      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <header className="mb-8">
          <h1 className="font-serif text-2xl text-[var(--color-gold)]">🤫 Whispers</h1>
          <p className="text-sm text-[var(--color-text-muted)] italic mt-1">
            Location-triggered rumors and overheard fragments
          </p>
        </header>

        <RavenOverheardQueue />
      </div>
    </div>
  );
}
