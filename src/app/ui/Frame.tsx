// Shared menu chrome (design from the ganggamchan_menu_ui package): gold-framed navy panel and line icons.
import type { HTMLAttributes, ReactNode } from 'react';

/** Navy panel with a gold border and four corner ornaments. */
export function Frame({ className = '', children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`panel ${className}`.trim()} {...rest}>
      <span className="corner tl" aria-hidden="true" />
      <span className="corner tr" aria-hidden="true" />
      <span className="corner bl" aria-hidden="true" />
      <span className="corner br" aria-hidden="true" />
      {children}
    </div>
  );
}

export type GlyphKind = 'sword' | 'book' | 'gear';

export function MenuGlyph({ kind }: { kind: GlyphKind }) {
  return (
    <svg className="glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'sword' ? (
        <>
          <path d="m5 19 3-3m-3-4 7 7M8 13 17 4l3-1-1 4-9 9" />
          <path d="m16 5 3 3" />
        </>
      ) : kind === 'book' ? (
        <>
          <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" />
          <path d="M6 9h3m6 0h3M6 13h3m6 0h3" />
        </>
      ) : (
        <>
          <path d="m10 3-.7 2.4-2 .9L5 5.7 2.8 9.5l1.7 1.8v2.1l-1.7 1.9L5 19l2.3-.6 2 .9L10 22h4l.7-2.7 2-.9 2.3.6 2.2-3.7-1.7-1.9v-2.1l1.7-1.8L19 5.7l-2.3.6-2-.9L14 3Z" />
          <circle cx="12" cy="12.5" r="3" />
        </>
      )}
    </svg>
  );
}
