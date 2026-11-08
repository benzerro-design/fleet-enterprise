import { TireCustodyDriverSignClient } from "./TireCustodyDriverSignClient";

type PageProps = { params: Promise<{ token: string }> };

export default async function TireCustodyDriverSignPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-10 text-zinc-100">
      <TireCustodyDriverSignClient token={token} />
    </main>
  );
}
