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
  return <span className="text-primary inline-flex items-center rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-medium">{children}</span>;
}
