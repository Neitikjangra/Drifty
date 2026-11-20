import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { spikeEnabled } from "@/lib/env";
import { SpikeClient } from "./spike-client";

export const metadata: Metadata = { title: "Spike · Drifty", robots: { index: false } };

export default function SpikePage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground p-6 text-center text-sm">Loading…</p>}
    >
      <SpikeGate />
    </Suspense>
  );
}

async function SpikeGate() {
  await connection(); // env flags are read at request time, not build time
  if (!spikeEnabled()) notFound();
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "";
  if (!appKey) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-lg font-semibold">Chat isn&apos;t configured</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Add the Nexconn App Key and App Secret to the environment, then reload.
        </p>
      </main>
    );
  }
  return <SpikeClient appKey={appKey} />;
}
