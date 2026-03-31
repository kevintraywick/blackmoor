export const dynamic = 'force-dynamic';

import Image from 'next/image';
import SplashNav from '@/components/SplashNav';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';

export default async function HomePage() {
  await ensureSchema();
  const players = await getPlayers();

  return (
    <div className="min-h-screen bg-[#2a3140] relative">
      {/* Splash art fills the whole viewport, sits behind the nav */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/images/splash/home_splash_2.png"
          alt="Shadow of the Wolf"
          fill
          className="object-contain object-top"
          priority
          style={{ transform: 'scale(1.5) translateY(66px)', transformOrigin: 'top center' }}
        />
      </div>
      {/* Nav floats above the image */}
      <div className="relative z-10">
        <SplashNav players={players} />
      </div>
    </div>
  );
}
