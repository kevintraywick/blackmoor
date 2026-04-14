'use client';

/**
 * Editor toolbar — Preview + Publish circles, positioned top-right, OUTSIDE
 * the broadsheet frame. Preview opens the dedicated /dm/raven-post/preview
 * route in a new tab. Publish triggers the publish endpoint (wired in the
 * editor page, not here).
 *
 * Circle styling matches the session control bar circles (64px transparent
 * with a thin border); publish is filled green per DESIGN.md §DM context.
 */

interface Props {
  onPublish: () => void;
  publishing: boolean;
  publishDisabled: boolean;
}

export default function EditorToolbar({ onPublish, publishing, publishDisabled }: Props) {
  const circleBase: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'EB Garamond, serif',
    fontSize: '0.55rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    textAlign: 'center',
    cursor: 'pointer',
    border: '1px solid rgba(201,168,76,0.4)',
    background: 'transparent',
    color: '#ffffff',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <a
        href="/dm/raven-post/preview"
        target="_blank"
        rel="noopener noreferrer"
        title="Preview as player"
        style={{
          ...circleBase,
          textDecoration: 'none',
        }}
      >
        Preview
      </a>
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing || publishDisabled}
        title={publishDisabled ? 'Fill in the required fields before publishing' : 'Publish this issue'}
        style={{
          ...circleBase,
          background: publishDisabled ? '#3a4a3a' : '#2d5a3f',
          borderColor: publishDisabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
          cursor: publishing ? 'wait' : (publishDisabled ? 'not-allowed' : 'pointer'),
          opacity: publishing ? 0.7 : 1,
          fontWeight: 700,
        }}
      >
        {publishing ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
