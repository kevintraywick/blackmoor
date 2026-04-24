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
  // DM uploads (paths under /api/) override both layouts. Otherwise each
  // layout picks its dedicated default. Mobile uses a face-only image with
  // the text rendered as a separate right-justified overlay so the text
  // never gets cropped at narrow widths.
  const dbSplash = campaignRows[0]?.home_splash_path;
  const isCustomUpload = !!dbSplash?.startsWith('/api/');
  const splashSrc = isCustomUpload ? dbSplash! : '/images/splash/tears_with_text.png';
  const mobileSplashSrc = isCustomUpload ? dbSplash! : '/images/splash/tears_clean.png';
  // Mobile-only text overlay — pre-cropped to just the vertical text strip
  // (120x680). Skipped when the DM has uploaded a custom splash, since the
  // upload presumably has its own typography.
  const mobileTextOverlaySrc = isCustomUpload ? null : '/images/splash/until_death_strip.png';
  // next/image doesn't play well with our /api/uploads/* serve routes
  // (no intrinsic dimensions, no optimization pipeline). Fall back to a
  // plain <img> for uploaded paths, keep <Image> for the committed default.
  const isUploaded = splashSrc.startsWith('/api/');

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#000' }}>
      {/* Splash art fills the whole viewport, sits behind the nav */}
      <div className="absolute inset-0 overflow-hidden">
        {isUploaded ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={splashSrc}
              alt="Shadow of the Wolf"
              className="hidden sm:block absolute inset-0 w-full h-full object-contain"
              style={{ objectPosition: 'left top', transform: 'scale(1.2) translateY(61px)', transformOrigin: 'top left' }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mobileSplashSrc}
              alt="Shadow of the Wolf"
              className="sm:hidden absolute inset-0 w-full h-full object-cover object-top"
              style={{ transform: 'translateY(200px)' }}
            />
          </>
        ) : (
          <>
            {/* Desktop splash */}
            <Image
              src={splashSrc}
              alt="Shadow of the Wolf"
              fill
              className="hidden sm:block object-contain"
              priority
              style={{ objectPosition: 'left top', transform: 'scale(1.2) translateY(61px)', transformOrigin: 'top left' }}
            />
            {/* Mobile splash — clean face, text overlaid separately */}
            <Image
              src={mobileSplashSrc}
              alt="Shadow of the Wolf"
              fill
              className="sm:hidden object-cover object-top"
              priority
              style={{ transform: 'translateY(200px)' }}
            />
          </>
        )}
        {/* Mobile-only text overlay — anchored to the viewport's right edge.
            Image is square; text strip sits at ~80–86% of width. translateX(14vh)
            shifts the canvas right so the text strip's right edge meets the right
            border of the viewport. */}
        {mobileTextOverlaySrc && (
          <>
            <style>{`@media (min-width: 640px) { .splash-text-overlay { display: none !important; } }`}</style>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mobileTextOverlaySrc}
              alt=""
              aria-hidden="true"
              className="splash-text-overlay"
              style={{
                position: 'absolute',
                bottom: 145,                    // sits just above the DM circle area
                right: 52,                      // 24 (px-6 padding) + 28 (half DM circle) = DM circle's center from the right
                height: '50vh',                 // moderate height; preserves aspect via width:auto
                width: 'auto',                  // strip's natural 120:680 aspect
                transform: 'translateX(50%)',   // shift right by half its own width to center on the DM circle's x
                pointerEvents: 'none',
                zIndex: 20,
              }}
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
