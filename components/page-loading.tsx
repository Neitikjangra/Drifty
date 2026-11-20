/** Fallback while a page's server data streams in. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex flex-1 items-center justify-center p-10 text-sm" role="status">
      {label}
    </div>
  );
}
