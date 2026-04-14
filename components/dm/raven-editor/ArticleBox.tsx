'use client';

/**
 * Visual frame around an editable article (headline + body). Keeps the
 * editor footprint stable regardless of how much content the DM has typed
 * so the layout looks like the final newspaper page even when fields are
 * empty.
 *
 * Intentionally minimal — just a 1px border + padding. The headline and
 * EditableProse inside bring their own styling.
 */

interface Props {
  children: React.ReactNode;
  /** Minimum footprint of the whole article (headline + body). */
  minHeight?: number;
  /** Flex-grow weight. `true` = 1. Number shares the column proportionally. */
  grow?: boolean | number;
}

export default function ArticleBox({ children, minHeight, grow }: Props) {
  const flexValue =
    grow === true ? 1 :
    typeof grow === 'number' ? grow :
    undefined;
  return (
    <div
      style={{
        border: '1px solid rgba(43,31,20,0.25)',
        padding: 8,
        background: 'transparent',
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        flex: flexValue,
      }}
    >
      {children}
    </div>
  );
}
