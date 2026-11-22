import Image from "next/image";

/** Drifty wordmark: the brand "D" mark (public/brand/drifty-mark.png) plus the name. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <Image src="/brand/drifty-mark.png" alt="" width={26} height={26} priority className="rounded-md" />
      <span>Drifty</span>
    </span>
  );
}
