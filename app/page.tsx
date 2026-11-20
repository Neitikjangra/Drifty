export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-muted-foreground text-sm font-medium">Drifty · coming soon</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Stop chasing client feedback.
      </h1>
      <p className="text-muted-foreground text-base leading-relaxed">
        Drifty is the room where client feedback actually happens. AI turns messages and voice
        notes into a confirmed change list, catches versions that miss a change, and records a
        tamper-proof approval.
      </p>
    </main>
  );
}
