export const dynamic = 'force-dynamic';

import Image from 'next/image';
import SplashNav from '@/components/SplashNav';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';

export default async function HomePage() {
  await ensureSchema();
  const players = await getPlayers();

  return (
    <div className="min-h-screen bg-[#2a3140] flex flex-col">
      <SplashNav players={players} />
      {/* Campaign splash art fills the remaining viewport */}
      <div className="flex-1 relative overflow-hidden">
        <Image
          src="/SOTW_splash.png"
          alt="Shadow of the Wolf"
          fill
          className="object-contain object-top"
          priority
          style={{ transform: 'translateY(-30px)' }}
        />
      </div>
    </div>
  );
}
