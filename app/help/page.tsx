import Link from 'next/link';
import DmNav from '@/components/DmNav';

export const metadata = {
  title: 'Help — Shadow of the Wolf',
};

const CARDS: { href: string; title: string; tagline: string; accent: string }[] = [
  {
    href: '/help/editions',
    title: 'D&D 5e → 5.5e',
    tagline: 'Side-by-side reference for rule changes, classes, species, and DM notes.',
    accent: '#ff7a3d',
  },
  {
    href: '/help/gossip',
    title: 'The Web of Whispers',
    tagline: 'A communication system for Dungeon Masters — twelve channels for rumor, omen, and news.',
    accent: '#a78bfa',
  },
];

export default function HelpPage() {
  return (
    <div style={{ background: '#000000', minHeight: '100vh', color: '#f7f1e6', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <DmNav current="help" />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '72px 32px 96px' }}>
        <header style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', letterSpacing: '0.2em', color: '#8a7f72', textTransform: 'uppercase', marginBottom: 12 }}>
            DM Library
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '3rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #ff7a3d 0%, #f472b6 50%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Help
          </h1>
          <p style={{ color: '#c9bdae', fontSize: '1.05rem', marginTop: 12, maxWidth: 640 }}>
            Reference material for running a Shadow of the Wolf campaign.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '28px 24px',
                background: '#15110e',
                border: '1px solid #262019',
                borderRadius: 12,
                transition: 'border-color 0.2s, transform 0.2s',
              }}
              className="help-card"
            >
              <div style={{ width: 40, height: 4, background: card.accent, borderRadius: 2, marginBottom: 20 }} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#f7f1e6' }}>
                {card.title}
              </h2>
              <p style={{ color: '#8a7f72', fontSize: '0.95rem', marginTop: 10, lineHeight: 1.55 }}>
                {card.tagline}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <style>{`
        .help-card:hover { border-color: #3a3128 !important; transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
