import Link from 'next/link';

export type NavSection = 'campaign' | 'sessions' | 'players' | 'npcs' | 'initiative' | 'maps' | 'magic' | 'marketplace' | 'poisons' | 'inventory';

const LINKS: { key: NavSection; label: string; href: string }[] = [
  { key: 'campaign',    label: 'Campaign',         href: '/dm/campaign' },
  { key: 'sessions',    label: 'Sessions',        href: '/dm' },
  { key: 'players',     label: 'Players',         href: '/dm/players' },
  { key: 'npcs',        label: 'NPCs',            href: '/dm/npcs' },
  { key: 'initiative',  label: 'Initiative',      href: '/dm/initiative' },
  { key: 'maps',        label: 'Maps',            href: '/dm/maps' },
  { key: 'magic',       label: 'Magic',           href: '/dm/magic' },
  { key: 'marketplace', label: 'Marketplace',     href: '/dm/marketplace' },
  { key: 'inventory',   label: 'Inventory',       href: '/dm/inventory' },
  { key: 'poisons',     label: 'Poisons & Traps', href: '/dm/poisons' },
];

export default function DmNav({ current, sessionId }: { current: NavSection; sessionId?: string }) {
  return (
    <nav className="sticky top-0 bg-[#4a7a5a] backdrop-blur border-b border-[#5a8a6a] px-8 py-2.5 flex items-center gap-2 z-10 text-sm font-serif">
      <Link href="/" className="text-white/70 hover:text-white transition-colors no-underline">
        ← Home
      </Link>
      {LINKS.map(link => {
        const href = link.key === 'maps' && sessionId ? `/dm/maps?session=${sessionId}` : link.href;
        return (
          <span key={link.key} className="contents">
            <span className="text-white/30 select-none">·</span>
            {link.key === current
              ? <span className="text-white font-semibold">{link.label}</span>
              : <Link href={href} className="text-white/70 hover:text-white transition-colors no-underline">{link.label}</Link>
            }
          </span>
        );
      })}
    </nav>
  );
}
