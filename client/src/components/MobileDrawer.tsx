'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  title?: string;
}

// Bottom-sheet / side-drawer wrapper built on the base Dialog primitive.
// Used for mobile menu + chat overlay.
export function MobileDrawer({
  open,
  onOpenChange,
  side = 'bottom',
  children,
  className,
  title,
}: MobileDrawerProps) {
  const posClasses =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t'
      : side === 'left'
      ? 'inset-y-0 left-0 w-[85vw] max-w-sm rounded-r-2xl border-r'
      : 'inset-y-0 right-0 w-[85vw] max-w-sm rounded-l-2xl border-l';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed z-50 flex flex-col bg-surface-container border-outline outline-none p-4',
            posClasses,
            'data-open:animate-in data-closed:animate-out',
            side === 'bottom' && 'data-open:slide-in-from-bottom data-closed:slide-out-to-bottom',
            side === 'left' && 'data-open:slide-in-from-left data-closed:slide-out-to-left',
            side === 'right' && 'data-open:slide-in-from-right data-closed:slide-out-to-right',
            className
          )}
        >
          {title && (
            <DialogPrimitive.Title className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              {title}
            </DialogPrimitive.Title>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
