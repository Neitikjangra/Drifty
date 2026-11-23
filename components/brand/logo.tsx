import Image from "next/image";

/** Drifty wordmark: the brand "D" mark (public/brand/drifty-mark-lime.png) plus the name. */
/** `compact`: the wordmark hides on very narrow phones (the mark stays). */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <Image src="/brand/drifty-mark-lime.png" alt="" width={26} height={26} priority className="rounded-md" />
      <span className={compact ? "hidden min-[380px]:inline" : undefined}>Drifty</span>
    </span>
  );
}
