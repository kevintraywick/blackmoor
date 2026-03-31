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
        {/* Desktop splash */}
        <Image
          src="/images/splash/home_splash_2.png"
          alt="Shadow of the Wolf"
          fill
          className="hidden sm:block object-contain object-top"
          priority
          style={{ transform: 'scale(1.35) translateY(-114px)', transformOrigin: 'top center' }}
        />
        {/* Mobile splash — no scale, cover the screen */}
        <Image
          src="/images/splash/home_splash_2.png"
          alt="Shadow of the Wolf"
          fill
          className="sm:hidden object-cover object-top"
          priority
        />
      </div>
      {/* Nav floats above the image */}
      <div className="relative z-10">
        <SplashNav players={players} />
      </div>
    </div>
  );
}
