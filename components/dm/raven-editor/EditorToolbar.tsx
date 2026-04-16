'use client';

/**
 * Editor toolbar — SAVED indicator + Preview + Publish circles, positioned
 * top-right, OUTSIDE the broadsheet frame. Preview opens the dedicated
 * /dm/raven-post/preview route in a new tab AFTER flushing any pending
 * autosave so the preview tab reads fresh DB state.
 *
 * Circle styling matches the session control bar circles (64px transparent
 * with a thin border); publish is filled green per DESIGN.md §DM context.
 */

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Props {
  onPublish: () => void;
  publishing: boolean;
  publishDisabled: boolean;
  saveStatus: SaveStatus;
  onBeforePreview: () => Promise<void>;
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  dirty: 'Unsaved',
  saving: 'Saving…',
  saved: 'Saved ✓',
  error: 'Save failed',
};

const STATUS_COLOR: Record<SaveStatus, string> = {
  idle: 'transparent',
  dirty: '#c9a84c',   // gold
  saving: '#8a7a60',  // muted
  saved: '#6ab07a',   // green
  error: '#c07a8a',   // pink
};

export default function EditorToolbar({
  onPublish,
  publishing,
  publishDisabled,
  saveStatus,
  onBeforePreview,
}: Props) {
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

  async function onPreviewClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    // Open the tab synchronously so popup blockers allow it; navigate it
    // once the save has flushed.
    // NOTE: do NOT pass 'noopener'/'noreferrer' here — per spec, window.open
    // returns null when noopener is set, leaving the new tab stuck on
    // about:blank. We need the window handle so we can navigate it after
    // the autosave flush completes. Same-origin, so the lost noopener
    // protection is not a concern.
    const w = window.open('about:blank', '_blank');
    try {
      await onBeforePreview();
    } finally {
      if (w) {
        w.location.href = '/dm/raven-post/preview';
      } else {
        // Popup blocked — fall back to navigating in this tab.
        window.location.href = '/dm/raven-post/preview';
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {/* SAVED indicator — fixed-height slot so layout doesn't jump */}
      <div
        style={{
          height: 14,
          minWidth: 64,
          fontFamily: 'EB Garamond, serif',
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'center',
          color: STATUS_COLOR[saveStatus],
          fontStyle: saveStatus === 'error' ? 'italic' : 'normal',
          transition: 'color 200ms ease',
        }}
      >
        {STATUS_LABEL[saveStatus]}
      </div>
      <a
        href="/dm/raven-post/preview"
        onClick={onPreviewClick}
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
