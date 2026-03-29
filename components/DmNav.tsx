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
    <nav className="sticky top-0 bg-[#161d18]/95 backdrop-blur border-b border-[#4a7a5a]/40 px-8 py-2.5 flex items-center gap-2 z-10 text-sm font-serif">
      <Link href="/" className="text-[#4a6a55] hover:text-[#5ab87a] transition-colors no-underline">
        ← Home
      </Link>
      {LINKS.map(link => {
        const href = link.key === 'maps' && sessionId ? `/dm/maps?session=${sessionId}` : link.href;
        return (
          <span key={link.key} className="contents">
            <span className="text-[#2a4a35] select-none">·</span>
            {link.key === current
              ? <span className="text-[#5ab87a] font-semibold">{link.label}</span>
              : <Link href={href} className="text-[#4a8a5a] hover:text-[#5ab87a] transition-colors no-underline">{link.label}</Link>
            }
          </span>
        );
      })}
    </nav>
  );
}
