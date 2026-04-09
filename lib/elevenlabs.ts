import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { canSpend, record } from './spend';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/newsie`;
const PUBLIC_PREFIX = '/api/uploads/raven-post/newsie';

// ElevenLabs charges per character of input text. As of 2026-04 the
// Starter plan is $5 / 30k chars ≈ $0.000167/char.
const ELEVENLABS_USD_PER_CHAR = 0.000167;

interface RenderArgs {
  /** A list of headline strings; the helper stitches them into a single newsie shout. */
  headlines: string[];
}

interface RenderResult {
  mp3PublicUrl: string;
  filename: string;
}

/**
 * Render a newsie audio clip with ElevenLabs and cache it on disk.
 *
 * Silently returns null if:
 *  - ELEVENLABS_API_KEY is not set
 *  - the service is paused on the budget tracker
 *  - the API call fails for any reason
 *
 * On success returns the public URL the player can hit.
 */
export async function renderNewsie({ headlines }: RenderArgs): Promise<RenderResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || headlines.length === 0) return null;

  if (!(await canSpend('elevenlabs'))) {
    console.log('renderNewsie: skipped — budget paused');
    return null;
  }

  // Build the script. Period-flavored barker patter.
  const script = `News! News! ${headlines.join('. ')}. News!`;
  const charCount = script.length;

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'; // Bella default

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.55, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      console.error('renderNewsie failed:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const mp3 = Buffer.from(await res.arrayBuffer());
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.mp3`;
    await writeFile(join(UPLOAD_DIR, filename), mp3);

    const cost = charCount * ELEVENLABS_USD_PER_CHAR;
    await record({
      service: 'elevenlabs',
      amount_usd: cost,
      units: charCount,
      unit_kind: 'chars',
      details: { filename, voiceId, model: 'eleven_multilingual_v2' },
      ref: { table: 'raven_items', id: filename },
    });

    return {
      mp3PublicUrl: `${PUBLIC_PREFIX}/${filename}`,
      filename,
    };
  } catch (err) {
    console.error('renderNewsie error:', err);
    return null;
  }
}
