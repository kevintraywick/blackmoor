import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

// Returns the public URLs of every image in a known rotating-banner
// folder under `public/`. Rotating components (e.g. PlayerBanner) call
// this on mount so new images auto-join the rotation — no code change
// required. Allowlisted folders only; arbitrary path scanning is not
// permitted.

interface FolderConfig {
  dir: string;            // path relative to `public/`
  prefix: string;         // filename prefix to match (e.g. 'player_banner_')
}

const BANNER_FOLDERS: Record<string, FolderConfig> = {
  players: {
    dir: 'images/players/player_banners',
    prefix: 'player_banner_',
  },
};

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folder: string }> },
) {
  const { folder } = await params;
  const config = BANNER_FOLDERS[folder];
  if (!config) {
    return NextResponse.json({ error: 'Unknown banner folder' }, { status: 404 });
  }

  const absDir = join(process.cwd(), 'public', config.dir);
  try {
    const files = await readdir(absDir);
    const matched = files
      .filter((name) => {
        if (!name.startsWith(config.prefix)) return false;
        const dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        return IMAGE_EXT.has(name.slice(dot).toLowerCase());
      })
      .sort((a, b) => {
        // Numeric sort on the suffix so _2 comes before _10.
        const na = parseInt(a.slice(config.prefix.length), 10);
        const nb = parseInt(b.slice(config.prefix.length), 10);
        return (Number.isNaN(na) ? 0 : na) - (Number.isNaN(nb) ? 0 : nb);
      })
      .map((name) => `/${config.dir}/${name}`);
    return NextResponse.json({ images: matched });
  } catch (err) {
    console.error(`GET /api/banners/${folder}`, err);
    return NextResponse.json({ error: 'Failed to list banner folder' }, { status: 500 });
  }
}
