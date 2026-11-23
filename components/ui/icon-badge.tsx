import type { LucideIcon } from "lucide-react";

/** A lime line icon in a round dark badge, the app's standard icon treatment. */
export function IconBadge({ icon: Icon, size = "md", className = "" }: { icon: LucideIcon; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  const glyph = size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";
  return (
    <span
      className={`text-primary inline-flex shrink-0 items-center justify-center rounded-full border border-lime-400/20 bg-lime-400/10 ${box} ${className}`}
      aria-hidden
    >
      <Icon className={glyph} strokeWidth={1.75} />
    </span>
  );
}

/** Small pill label above a section heading ("Feature", "Pricing"...). */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="lux-pill text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
      <span className="bg-primary size-1.5 rounded-full shadow-[0_0_8px_rgb(200_241_53/0.9)]" aria-hidden />
      {children}
    </span>
  );
}

/**
 * The hero's premium badge: glass pill with a lime gradient hairline and a slow light sweep,
 * Drifty's own glyph in a lime coin, the label, and a quiet trailing note.
 */
export function HeroBadge({ glyph, children, note }: { glyph: React.ReactNode; children: React.ReactNode; note?: string }) {
  return (
    <span className="lux-pill inline-flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-sm">
      <span className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-full shadow-[0_0_18px_-4px_rgb(200_241_53/0.8)]">
        {glyph}
      </span>
      <span className="text-foreground font-medium tracking-tight">{children}</span>
      {note && (
        <>
          <span className="bg-border h-3.5 w-px" aria-hidden />
          <span className="accent-serif text-sheen text-base leading-none">{note}</span>
        </>
      )}
    </span>
  );
}
