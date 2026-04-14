'use client';

import { useState } from 'react';
import type { RavenItem, RavenWeatherRow } from '@/lib/types';
import RavenBroadsheet, { type IssueAssembly } from './RavenBroadsheet';

interface IssueInfo {
  raven_volume: number;
  raven_issue: number;
  published_at: string;
}

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string;
  issues: IssueInfo[];
  /** Assembly of the latest published issue. Undefined on fresh installs. */
  assembly?: IssueAssembly;
}

export default function RavenPostPlayer({ items, weather, volume, issue, inFictionDate, issues, assembly }: Props) {
  // null = latest (current issue)
  const [selectedIssue, setSelectedIssue] = useState<{ vol: number; iss: number } | null>(null);

  // Filter items to selected issue, or show latest if no issue selected
  const displayItems = selectedIssue
    ? items.filter(i => i.raven_volume === selectedIssue.vol && i.raven_issue === selectedIssue.iss)
    : items.filter(i => {
        // Show items from the current issue, plus any without an issue stamp (legacy)
        return (i.raven_volume === volume && i.raven_issue === issue) || i.raven_volume == null;
      });

  const displayVolume = selectedIssue?.vol ?? volume;
  const displayIssue = selectedIssue?.iss ?? issue;

  // Past issues = all issues except the current one
  const pastIssues = issues.filter(i => !(i.raven_volume === volume && i.raven_issue === issue));

  return (
    <div>
      <RavenBroadsheet
        items={displayItems}
        weather={weather}
        volume={displayVolume}
        issue={displayIssue}
        inFictionDate={inFictionDate}
        assembly={selectedIssue ? undefined : assembly}
      />

      {/* Past Issues nav */}
      {pastIssues.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'var(--color-text-muted)',
          }}>
            Past Issues
          </span>
          {selectedIssue && (
            <button
              onClick={() => setSelectedIssue(null)}
              style={{
                background: 'none',
                border: '1px solid var(--color-gold)',
                padding: '4px 10px',
                fontSize: '0.7rem',
                color: 'var(--color-gold)',
                cursor: 'pointer',
                fontFamily: 'EB Garamond, serif',
              }}
            >
              ← Current Issue
            </button>
          )}
          {pastIssues.map(pi => {
            const isActive = selectedIssue?.vol === pi.raven_volume && selectedIssue?.iss === pi.raven_issue;
            return (
              <button
                key={`${pi.raven_volume}-${pi.raven_issue}`}
                onClick={() => setSelectedIssue({ vol: pi.raven_volume, iss: pi.raven_issue })}
                style={{
                  background: isActive ? 'rgba(201,168,76,0.15)' : 'none',
                  border: `1px solid ${isActive ? 'var(--color-gold)' : 'var(--color-border)'}`,
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  color: isActive ? 'var(--color-gold)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'EB Garamond, serif',
                }}
              >
                Issue {pi.raven_issue}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
