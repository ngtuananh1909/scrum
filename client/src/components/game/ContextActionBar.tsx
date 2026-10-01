import type { ReactNode } from 'react';

export interface ContextActionBarProps {
  title: string;
  description: string;
  waiting?: boolean;
  children: ReactNode;
}

/** Persistent, thumb-reachable summary of what the player can do right now. */
export function ContextActionBar({ title, description, waiting = false, children }: ContextActionBarProps) {
  return (
    <section
      aria-label="Hành động hiện tại"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-low/95 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_32px_rgba(0,0,0,0.16)] backdrop-blur-xl md:left-72 lg:right-80 xl:left-80"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 sm:max-w-[48%]">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${waiting ? 'bg-muted-foreground' : 'bg-secondary'}`} aria-hidden="true" />
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap justify-stretch gap-2 sm:justify-end [&>button]:min-h-11 [&>button]:flex-1 [&>button]:sm:flex-initial">
          {children}
        </div>
      </div>
    </section>
  );
}
