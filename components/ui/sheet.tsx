"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * A side panel built on the native <dialog> (focus trap, Esc to close, inert page behind).
 * Full width on phones, a right-hand panel from `sm` up.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  width = "sm:max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`bg-background text-foreground m-0 ml-auto h-dvh max-h-dvh w-full max-w-full border-l p-0 shadow-xl backdrop:bg-black/40 ${width}`}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground rounded p-1">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
