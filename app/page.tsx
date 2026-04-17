export const dynamic = 'force-dynamic';

import Image from 'next/image';
import SplashNav from '@/components/SplashNav';
import { ensureSchema } from '@/lib/schema';
import { getPlayers } from '@/lib/getPlayers';
import { query } from '@/lib/db';

export default async function HomePage() {
  await ensureSchema();
  const [players, presenceRows, campaignRows] = await Promise.all([
    getPlayers({ publicOnly: true }),
    query<{ player_id: string }>(
      `SELECT player_id FROM player_presence WHERE last_seen > NOW() - INTERVAL '90 seconds'`
    ),
    query<{ home_splash_path: string }>(
      `SELECT home_splash_path FROM campaign WHERE id = 'default' LIMIT 1`
    ),
  ]);
  const onlinePlayers = presenceRows.map(r => r.player_id);
  const splashSrc = campaignRows[0]?.home_splash_path || '/images/splash/home_splash_2.png';
  // next/image doesn't play well with our /api/uploads/* serve routes
  // (no intrinsic dimensions, no optimization pipeline). Fall back to a
  // plain <img> for uploaded paths, keep <Image> for the committed default.
  const isUploaded = splashSrc.startsWith('/api/');

  return (
    <div className="min-h-screen bg-[#2a3140] relative">
      {/* Splash art fills the whole viewport, sits behind the nav */}
      <div className="absolute inset-0 overflow-hidden">
        {isUploaded ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={splashSrc}
              alt="Shadow of the Wolf"
              className="hidden sm:block absolute inset-0 w-full h-full object-contain object-top"
              style={{ transform: 'scale(1.35) translateY(-14px)', transformOrigin: 'top center' }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={splashSrc}
              alt="Shadow of the Wolf"
              className="sm:hidden absolute inset-0 w-full h-full object-cover object-top"
            />
          </>
        ) : (
          <>
            {/* Desktop splash */}
            <Image
              src={splashSrc}
              alt="Shadow of the Wolf"
              fill
              className="hidden sm:block object-contain object-top"
              priority
              style={{ transform: 'scale(1.35) translateY(-14px)', transformOrigin: 'top center' }}
            />
            {/* Mobile splash — no scale, cover the screen */}
            <Image
              src={splashSrc}
              alt="Shadow of the Wolf"
              fill
              className="sm:hidden object-cover object-top"
              priority
            />
          </>
        )}
      </div>
      {/* Nav floats above the image */}
      <div className="relative z-10">
        <SplashNav players={players} onlinePlayers={onlinePlayers} />
      </div>
    </div>
  );
}
