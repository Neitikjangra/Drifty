import { SiteFooter, SiteHeader } from "./site-chrome";

/** Shared layout for privacy/terms. `draft` shows a notice until the team's final text is in. */
export function LegalPage({ title, updated, draft = true, children }: { title: string; updated: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {draft && (
          <p className="mb-6 rounded-xl border border-beige-400 bg-beige-500 p-3 text-sm text-beige-100">
            Pilot draft: this text is being reviewed and may change before general launch.
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Last updated {updated}</p>
        <div className="mt-6 space-y-5 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
