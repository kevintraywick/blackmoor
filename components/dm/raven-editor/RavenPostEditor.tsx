'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RavenIssueDraft } from '@/lib/types';
import { pickRandomQotd } from '@/lib/qotd';
import Masthead from '@/components/raven/Masthead';
import SpotPrices from '@/components/raven/SpotPrices';
import EditableHeadline from './EditableHeadline';
import EditableProse from './EditableProse';
import QotdEditor from './QotdEditor';
import EditorToolbar from './EditorToolbar';

interface Props {
  initialDraft: RavenIssueDraft;
  volume: number;
  issue: number;
  inFictionDate: string;
}

// Target word counts for Layout 1 v1 — see DESIGN.md.
const WORD_TARGETS = {
  col1_lead: 80,
  blood_moon: 60,
  crimson_moon: 80,
  opinion: 60,
} as const;

const AUTOSAVE_MS = 800;

type DraftField = keyof RavenIssueDraft;

export default function RavenPostEditor({ initialDraft, volume, issue, inFictionDate }: Props) {
  // Seed an initial QOTD into the draft on first render if empty, so the
  // editor always shows something. Kept in local state; autosave persists.
  const [draft, setDraft] = useState<RavenIssueDraft>(() => {
    if (initialDraft.qotd_text) return initialDraft;
    const q = pickRandomQotd();
    return { ...initialDraft, qotd_text: q.text, qotd_author: q.author };
  });

  // Track dirty fields since last flush so we only PUT the delta.
  const dirtyRef = useRef<Set<DraftField>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist QOTD seed on first mount if we synthesized one.
  useEffect(() => {
    if (!initialDraft.qotd_text && draft.qotd_text) {
      dirtyRef.current.add('qotd_text');
      dirtyRef.current.add('qotd_author');
      scheduleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flushSave() {
    const dirty = Array.from(dirtyRef.current);
    if (dirty.length === 0) return;
    dirtyRef.current = new Set();
    const patch: Record<string, unknown> = {};
    for (const f of dirty) patch[f] = draft[f];
    try {
      await fetch('/api/raven-post/issue-draft', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error('[editor] autosave failed', err);
    }
  }

  // Flush on unmount so fast navigations don't lose the last edit.
  useEffect(() => {
    return () => { flushSave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends DraftField>(field: K, value: RavenIssueDraft[K]) {
    setDraft(d => ({ ...d, [field]: value }));
    dirtyRef.current.add(field);
    scheduleSave();
  }

  // Publish wiring — Unit 8 provides the endpoint. Until then, stub.
  const [publishing, setPublishing] = useState(false);
  const publishDisabled = !(
    draft.big_headline.trim() &&
    draft.col1_lead_body.trim() &&
    draft.blood_moon_body.trim() &&
    draft.crimson_moon_body.trim() &&
    draft.opinion_body.trim()
  );

  async function onPublish() {
    if (publishing || publishDisabled) return;
    setPublishing(true);
    try {
      // Ensure any in-flight dirty fields land before publishing
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await flushSave();
      const res = await fetch('/api/raven-post/issue-publish', { method: 'POST' });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Publish failed' }));
        alert(msg ?? 'Publish failed');
        return;
      }
      alert('Issue published!');
    } catch (err) {
      console.error('publish', err);
      alert('Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Top-right toolbar — outside the broadsheet frame */}
      <div style={{ position: 'absolute', top: 0, right: -90, zIndex: 10 }}>
        <EditorToolbar onPublish={onPublish} publishing={publishing} publishDisabled={publishDisabled} />
      </div>

      {/* Broadsheet parchment container — matches RavenBroadsheet */}
      <div
        className="font-serif"
        style={{
          background: '#efe3c4',
          backgroundImage:
            'radial-gradient(circle at 20% 10%, rgba(139,90,30,0.08), transparent 50%),' +
            'radial-gradient(circle at 80% 90%, rgba(139,90,30,0.10), transparent 55%)',
          border: '1px solid #d9c89a',
          padding: '28px 30px',
          color: '#2b1f14',
          boxShadow: '0 8px 24px rgba(43,31,20,0.35), inset 0 0 80px rgba(139,90,30,0.08)',
          position: 'relative',
        }}
      >
        <Masthead volume={volume} issue={issue} inFictionDate={inFictionDate} />

        {/* Section (2) — Big Headline */}
        <div
          style={{
            borderBottom: '1px solid #2b1f14',
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          <EditableHeadline
            value={draft.big_headline}
            onChange={v => set('big_headline', v)}
            placeholder="ORC INVASION"
            variant="big"
          />
        </div>

        {/* 3-col grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 18,
            marginBottom: 18,
            alignItems: 'stretch',
          }}
        >
          {/* Column 1 — (3) lead → (8) ad → (10) QOTD */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Section (3) — lead text */}
            <div>
              <EditableHeadline
                value={draft.col1_lead_headline}
                onChange={v => set('col1_lead_headline', v)}
                placeholder="Lead column headline"
                variant="lead"
              />
              <EditableProse
                value={draft.col1_lead_body}
                onChange={v => set('col1_lead_body', v)}
                byline={draft.col1_lead_headline}
                sectionId="col1_lead"
                target={WORD_TARGETS.col1_lead}
                placeholder="Lead story body — type a headline and click 🧠 to draft with World AI."
              />
            </div>

            {/* Section (8) — Ad drop zone (Unit 5 will wire) */}
            <div
              style={{
                border: '1px dashed #2b1f14',
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: '#8a7a60',
                background: 'rgba(139,90,30,0.03)',
              }}
            >
              Drop ad image here
            </div>

            {/* Section (10) — QOTD */}
            <QotdEditor
              text={draft.qotd_text}
              author={draft.qotd_author}
              onChange={({ text, author }) => {
                set('qotd_text', text);
                set('qotd_author', author);
              }}
            />
          </div>

          {/* Column 2 — (4) hero + (5) caption → (7) blood moon → (9) spot prices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sections (4) + (5) — hero image + caption. Drop zone stub (Unit 5) */}
            <figure style={{ margin: 0 }}>
              {draft.hero_image_url ? (
                <img
                  src={draft.hero_image_url}
                  alt=""
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    border: '1px solid #2b1f14',
                    filter: 'sepia(0.15) contrast(1.05)',
                  }}
                />
              ) : (
                <div
                  style={{
                    border: '1px dashed #2b1f14',
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: '#8a7a60',
                    background: 'rgba(139,90,30,0.03)',
                  }}
                >
                  Drop hero image here
                </div>
              )}
              <figcaption
                style={{
                  fontSize: '0.8rem',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  borderTop: '1px solid #2b1f14',
                  borderBottom: '1px solid #2b1f14',
                  padding: '2px 0',
                  marginTop: 4,
                  color: '#2b1f14',
                }}
              >
                <input
                  value={draft.hero_caption}
                  onChange={e => set('hero_caption', e.target.value)}
                  placeholder="Caption"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontFamily: 'EB Garamond, serif',
                    fontSize: '0.8rem',
                    fontStyle: 'italic',
                    color: '#2b1f14',
                    background: 'transparent',
                    border: '1px solid transparent',
                    outline: 'none',
                    padding: '2px 4px',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2b1f14'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; }}
                />
              </figcaption>
            </figure>

            {/* Section (7) — Blood Moon */}
            <div>
              <EditableHeadline
                value={draft.blood_moon_headline}
                onChange={v => set('blood_moon_headline', v)}
                placeholder="Blood Moon headline"
                variant="article"
              />
              <EditableProse
                value={draft.blood_moon_body}
                onChange={v => set('blood_moon_body', v)}
                byline={draft.blood_moon_headline}
                sectionId="blood_moon"
                target={WORD_TARGETS.blood_moon}
                placeholder="Body — type a headline and click 🧠 to draft."
              />
            </div>

            {/* Section (9) — Spot Prices (pinned bottom) */}
            <SpotPrices style={{ marginTop: 'auto' }} />
          </div>

          {/* Column 3 — (6) crimson moon → (11) opinion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Section (6) — Crimson Moon */}
            <div>
              <EditableHeadline
                value={draft.crimson_moon_headline}
                onChange={v => set('crimson_moon_headline', v)}
                placeholder="Crimson Moon headline"
                variant="article"
              />
              <EditableProse
                value={draft.crimson_moon_body}
                onChange={v => set('crimson_moon_body', v)}
                byline={draft.crimson_moon_headline}
                sectionId="crimson_moon"
                target={WORD_TARGETS.crimson_moon}
                placeholder="Body — type a headline and click 🧠 to draft."
              />
            </div>

            {/* Section (11) — Opinion */}
            <div>
              <EditableHeadline
                value={draft.opinion_headline}
                onChange={v => set('opinion_headline', v)}
                placeholder="Opinion"
                variant="opinion"
              />
              <EditableProse
                value={draft.opinion_body}
                onChange={v => set('opinion_body', v)}
                byline={draft.opinion_headline}
                sectionId="opinion"
                target={WORD_TARGETS.opinion}
                placeholder="Opinion body — type a headline and click 🧠 to draft."
              />
            </div>
          </div>
        </div>

        {/* Bottom rule — echoes masthead */}
        <div style={{ marginTop: 4, borderTop: '4px double #2b1f14' }} />
      </div>
    </div>
  );
}
