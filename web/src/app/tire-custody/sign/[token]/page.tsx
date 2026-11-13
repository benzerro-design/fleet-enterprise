import { Suspense } from "react";
import { TireCustodyDriverSignClient } from "./TireCustodyDriverSignClient";

type PageProps = { params: Promise<{ token: string }> };

export default async function TireCustodyDriverSignPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-10 text-zinc-100">
      <Suspense
        fallback={
          <p className="mx-auto max-w-md text-center text-sm text-zinc-500">Se încarcă…</p>
        }
      >
        <TireCustodyDriverSignClient token={token} />
      </Suspense>
    </main>
  );
}
